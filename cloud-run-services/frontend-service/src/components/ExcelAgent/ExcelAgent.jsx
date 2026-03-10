import { useState, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { excelAgentStream } from '../../services/api';
import { formatStreamedText } from '../../utils/formatStreamedText';
import { highlightAllCodeBlocks } from '../../utils/markdown';
import SpreadsheetCanvas from './SpreadsheetCanvas';
import MessageBubble from '../Chat/MessageBubble';
import '../Chat/Chat.css';
import './ExcelAgent.css';

// speed tuning for the character‑by‑character animation; matches the vanilla HTML version
const STREAMING_SPEED_MODIFIER = 500;

const QUICK_PROMPTS = [
    'Sort by first column A→Z',
    'Remove empty rows',
    'Add a SUM row at the bottom',
    'Find duplicates',
    'Highlight outliers in red',
    'Format as a professional table',
];

export default function ExcelAgent({ initialFile, onClearFile }) {
    const { user, token } = useAuth();
    const [sheetNames, setSheetNames] = useState([]);
    const [activeSheet, setActiveSheet] = useState(0);
    const [sheetsData, setSheetsData] = useState([]); // array of 2D arrays per sheet
    const [openFiles, setOpenFiles] = useState([]); // Array of { name: string, sheetIndices: number[] }
    const [fileName, setFileName] = useState('');
    const [cellStyles, setCellStyles] = useState([]); // Array of objects mapping "r-c" to style, per sheet
    const [messages, setMessages] = useState([
        { role: 'ai', content: 'Upload an Excel or CSV file to get started. I can edit data, sort, filter, and now **visually format** your sheet with colors and styles!' }
    ]);

    // keep track of names we've already parsed (or are currently parsing) so
    // concurrent calls to parseFile can't add the same workbook twice
    const parsedFilesRef = useRef(new Set());
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [changedRows, setChangedRows] = useState([]);
    const [chatWidth, setChatWidth] = useState(360); // Default width
    const [isResizing, setIsResizing] = useState(false);

    // ── Mobile State ──
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [mobileTab, setMobileTab] = useState('chat'); // 'chat' or 'sheet'

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── History (Undo/Redo) ──
    const [history, setHistory] = useState([]); // Array of snapshots: { data: sheetsData, styles: cellStyles }
    const [historyIndex, setHistoryIndex] = useState(-1);

    const fileRef = useRef(null);
    const msgsBottom = useRef(null);

    useEffect(() => {
        msgsBottom.current?.scrollIntoView({ behavior: 'smooth' });
        // highlight code whenever new message html arrives
        const container = document.querySelector('.excel-messages');
        highlightAllCodeBlocks(container);
    }, [messages, isThinking]);

    // ── Resizing Logic ──
    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const doResizing = useCallback((e) => {
        if (isResizing) {
            const newWidth = e.clientX;
            if (newWidth > 280 && newWidth < 800) {
                setChatWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', doResizing);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', doResizing);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', doResizing);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, doResizing, stopResizing]);

    useEffect(() => {
        if (initialFile) {
            // don't add it twice if parent passes the same file again
            if (!openFiles.some(f => f.name === initialFile.name)
                && !parsedFilesRef.current.has(initialFile.name)) {
                parseFile(initialFile);
            }
        }
    }, [initialFile, openFiles]);

    // ── File Parsing ──────────────────────────────────────────
    const parseFile = (fileOrFiles) => {
        const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
        if (!files.length) return;

        files.forEach(file => {
            // prevent duplicates even if state hasn't updated yet
            if (parsedFilesRef.current.has(file.name)) {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    content: `⚠️ File **${file.name}** is already open, skipping duplicate.`,
                }]);
                return;
            }

            parsedFilesRef.current.add(file.name);

            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const names = wb.SheetNames;

                setSheetsData(prev => {
                    const startIdx = prev.length;
                    const newSheets = names.map(name => {
                        const ws = wb.Sheets[name];
                        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    });

                    const updatedData = [...prev, ...newSheets];

                    setSheetNames(prevNames => [...prevNames, ...names]);
                    setCellStyles(prevStyles => [...prevStyles, ...new Array(names.length).fill({})]);

                    setOpenFiles(prevFiles => {
                        // guard again here, just in case
                        if (prevFiles.some(f => f.name === file.name)) return prevFiles;
                        return [
                            ...prevFiles,
                            { name: file.name, sheetIndices: names.map((_, i) => startIdx + i) }
                        ];
                    });

                    if (prev.length === 0) {
                        setActiveSheet(0);
                        setFileName(file.name);
                    }

                    // Initialize/Save history
                    saveToHistory(updatedData, new Array(updatedData.length).fill({}));

                    return updatedData;
                });

                setMessages(prev => [...prev, {
                    role: 'ai',
                    content: `✅ Added **${file.name}** — ${names.length} sheet(s) loaded.`,
                    op: 'file-added',
                }]);
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        parseFile(files);
        // clear the value so the same file can be picked again later
        if (e.target) e.target.value = null;
    };

    const handleClearFile = (fileIndex) => {
        if (fileIndex === undefined) {
            setSheetsData([]);
            setSheetNames([]);
            setOpenFiles([]);
            setFileName('');
            setActiveSheet(0);
            setCellStyles([]);
            setHistory([]);
            setHistoryIndex(-1);
            parsedFilesRef.current.clear();
            onClearFile?.();
            return;
        }

        const fileToRemove = openFiles[fileIndex];
        const indicesToRemove = fileToRemove.sheetIndices;

        // remove from parsed ref as well so a user could re-add later
        parsedFilesRef.current.delete(fileToRemove.name);

        setOpenFiles(prev => prev.filter((_, i) => i !== fileIndex));
        setSheetsData(prev => prev.filter((_, i) => !indicesToRemove.includes(i)));
        setSheetNames(prev => prev.filter((_, i) => !indicesToRemove.includes(i)));
        setCellStyles(prev => prev.filter((_, i) => !indicesToRemove.includes(i)));

        // Adjust active sheet if it was part of the removed file
        setActiveSheet(prev => {
            if (indicesToRemove.includes(prev)) return 0;
            // Shift index down by how many sheets were removed before it
            const shift = indicesToRemove.filter(idx => idx < prev).length;
            return Math.max(0, prev - shift);
        });

        // Update sheet indices for remaining files
        setOpenFiles(prev => prev.map(f => ({
            ...f,
            sheetIndices: f.sheetIndices.map(idx => {
                const shift = indicesToRemove.filter(removedIdx => removedIdx < idx).length;
                return idx - shift;
            })
        })));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) parseFile(files);
    };

    // ── History Management ──
    const saveToHistory = (newData, newStyles) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            next.push({ data: newData, styles: newStyles });
            // Cap history at 50 steps
            if (next.length > 50) next.shift();
            return next;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    };

    const undo = () => {
        if (historyIndex <= 0) return;
        const prev = history[historyIndex - 1];
        setSheetsData(prev.data);
        setCellStyles(prev.styles);
        setHistoryIndex(historyIndex - 1);
    };

    const redo = () => {
        if (historyIndex >= history.length - 1) return;
        const next = history[historyIndex + 1];
        setSheetsData(next.data);
        setCellStyles(next.styles);
        setHistoryIndex(historyIndex + 1);
    };

    // ── Cell edit ────────────────────────────────────────────
    const handleCellChange = useCallback((rowIdx, colIdx, value) => {
        setSheetsData(prev => {
            const next = prev.map(s => s.map(r => [...r]));
            if (!next[activeSheet][rowIdx]) next[activeSheet][rowIdx] = [];
            next[activeSheet][rowIdx][colIdx] = value;

            // Record manual edits to history
            saveToHistory(next, cellStyles);
            return next;
        });
    }, [activeSheet, cellStyles, historyIndex]); // added cellStyles to deps for history

    // ── AI Chat ───────────────────────────────────────────────
    const sendMessage = async (msgText) => {
        const txt = msgText ?? input.trim();
        if (!txt || isThinking) return;
        setInput('');

        const userMsg = { role: 'user', content: txt };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        // placeholder for AI response (both raw and formatted html)
        const aiMsgId = Date.now();
        setMessages(prev => [...prev, { role: 'ai', content: '', html: '', id: aiMsgId }]);
        setIsThinking(true);

        // streaming state
        let fullText = "";
        let displayedText = "";
        let isStreaming = true;
        const openIndices = new Set();

        const animateText = () => {
            if (displayedText.length < fullText.length) {
                const bufferSize = fullText.length - displayedText.length;
                const chunkSize = Math.max(1, Math.min(bufferSize, Math.ceil(bufferSize / STREAMING_SPEED_MODIFIER) + 1));
                displayedText += fullText.slice(displayedText.length, displayedText.length + chunkSize);
                let html = formatStreamedText(displayedText);
                let count = 0;
                html = html.replace(/<details class="think-block-details">/g, (match) => {
                    const isOpen = openIndices.has(count++);
                    return isOpen ? '<details class="think-block-details" open>' : match;
                });
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, html } : m
                ));
                requestAnimationFrame(animateText);
            } else if (!isStreaming) {
                let html = formatStreamedText(fullText);
                let count = 0;
                html = html.replace(/<details class="think-block-details">/g, (match) => {
                    const isOpen = openIndices.has(count++);
                    return isOpen ? '<details class="think-block-details" open>' : match;
                });
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, html } : m
                ));
            } else {
                requestAnimationFrame(animateText);
            }
        };
        requestAnimationFrame(animateText);

        try {
            const currentData = sheetsData[activeSheet] || [];
            await excelAgentStream({
                message: txt,
                sheetData: currentData,
                token: token || 'guest',
                email: user?.email || 'guest@treevit.local',
                onJobQueued: (jobId, msg) => {
                    fullText = `📥 **${msg}**\n\nYour file is large, so I have safely queued it in the background to prevent your browser from freezing. Job ID: \`${jobId}\``;
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText } : m
                    ));
                    isStreaming = false;
                },
                onChunk: (chunk) => {
                    fullText += chunk;
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
                    ));
                },
                onData: (data) => {
                    // Update fullText if the server gives a final version
                    if (data.fullMessage) {
                        fullText = data.fullMessage;
                        // we don't immediately setMessages here, animation will flush when isStreaming turns false
                        setMessages(prev => prev.map(m =>
                            m.id === aiMsgId ? { ...m, op: data.operation } : m
                        ));
                    }

                    if (data.done) {
                        isStreaming = false;
                    }

                    if (data.updatedData) {
                        // Find changed rows
                        const changed = [];
                        data.updatedData.forEach((row, i) => {
                            const orig = currentData[i];
                            if (!orig || JSON.stringify(row) !== JSON.stringify(orig)) {
                                changed.push(i);
                            }
                        });
                        setChangedRows(changed);

                        let updatedStyles = cellStyles;
                        if (data.cellStyles) {
                            updatedStyles = cellStyles.map((s, i) => i === activeSheet ? { ...s, ...data.cellStyles } : s);
                            setCellStyles(updatedStyles);
                        }

                        setSheetsData(prev => {
                            const next = [...prev];
                            next[activeSheet] = data.updatedData;
                            saveToHistory(next, updatedStyles);
                            return next;
                        });

                        setTimeout(() => setChangedRows([]), 2000);
                    }
                }
            });
        } catch (err) {
            fullText = `⚠️ Error: ${err.message || 'Something went wrong'}`;
            // force immediate update
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: fullText } : m
            ));
        } finally {
            isStreaming = false;
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ── Download ──────────────────────────────────────────────
    const downloadExcel = () => {
        if (!sheetsData.length) return;
        const wb = XLSX.utils.book_new();
        sheetsData.forEach((data, i) => {
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, sheetNames[i] || `Sheet${i + 1}`);
        });
        XLSX.writeFile(wb, fileName || 'treevit-export.xlsx');
    };

    const hasData = sheetsData.length > 0 && sheetsData[activeSheet]?.length > 0;
    const currentData = sheetsData[activeSheet] || [];

    const chatStyle = isMobile
        ? { display: mobileTab === 'chat' ? 'flex' : 'none', width: '100%', minWidth: '100%' }
        : { width: chatWidth, minWidth: chatWidth };

    const canvasStyle = isMobile
        ? { display: mobileTab === 'sheet' ? 'flex' : 'none', width: '100%', minWidth: '100%' }
        : {};

    return (
        <div className={`excel-agent ${isResizing ? 'is-resizing' : ''} ${isMobile ? 'is-mobile' : ''}`}>

            {/* ── Mobile Tabs ── */}
            {isMobile && (
                <div className="excel-mobile-tabs">
                    <button
                        className={`excel-mobile-tab ${mobileTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setMobileTab('chat')}
                    >
                        <i className='bx bx-message-rounded-dots' /> Chat
                    </button>
                    <button
                        className={`excel-mobile-tab ${mobileTab === 'sheet' ? 'active' : ''}`}
                        onClick={() => setMobileTab('sheet')}
                    >
                        <i className='bx bx-spreadsheet' /> Data
                        {hasData && <span className="mobile-data-badge" />}
                    </button>
                </div>
            )}

            {/* ── Left: Chat Panel ── */}
            <div className="excel-chat-panel" style={chatStyle}>
                <div className="excel-chat-header">
                    <div className="excel-chat-header-icon">
                        <i className='bx bx-spreadsheet' />
                    </div>
                    <div>
                        <h3>Excel Agent</h3>
                        <p>AI-powered spreadsheet editor</p>
                    </div>
                </div>

                <div className="excel-messages">
                    {messages.map((msg, i) => (
                        <div key={msg.id || i} className="excel-message-wrapper">
                            <MessageBubble
                                msg={msg}
                                userPhoto={user?.photoURL}
                                userInitial={user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                                isStreaming={isThinking && i === messages.length - 1}
                            />
                            {msg.op && msg.op !== 'file-loaded' && (
                                <div className="op-badge" style={{ marginLeft: 50 }}>
                                    <i className='bx bx-check-circle' />
                                    {msg.op}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={msgsBottom} />
                </div>

                <div className="excel-chat-input-area">
                    {/* Quick prompts */}
                    <div className="excel-capabilities">
                        {QUICK_PROMPTS.map((p, i) => (
                            <span
                                key={i}
                                className="excel-cap-chip"
                                onClick={() => sendMessage(p)}
                            >
                                {p}
                            </span>
                        ))}
                    </div>

                    <div className="excel-chat-box">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={hasData ? 'Tell the AI what to do...' : 'Upload a file first...'}
                            disabled={!hasData && sheetsData.length === 0}
                            rows={2}
                        />
                        <button
                            className="excel-send-btn"
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || isThinking}
                        >
                            {isThinking
                                ? <i className='bx bx-loader-alt spin' />
                                : <i className='bx bxs-send' />
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Resizer (Hidden on Mobile) ── */}
            {!isMobile && (
                <div className={`excel-resizer ${isResizing ? 'active' : ''}`} onMouseDown={startResizing}>
                    <div className="resizer-handle" />
                </div>
            )}

            {/* ── Right: Canvas ── */}
            <div className="excel-canvas" style={canvasStyle}>
                {/* Toolbar */}
                <div className="excel-toolbar">
                    <div className="excel-toolbar-left">
                        {openFiles.length > 0 && (
                            <div className="excel-files-list">
                                {openFiles.map((file, fIdx) => (
                                    <div
                                        key={fIdx}
                                        className="excel-file-group"
                                        onClick={() => {
                                            if (file.sheetIndices.length > 0) {
                                                setActiveSheet(file.sheetIndices[0]);
                                            }
                                        }}
                                    >
                                        <div className="excel-file-name">
                                            <i className='bx bxs-file-blank' />
                                            <span>{file.name}</span>
                                            <i
                                                className='bx bx-x close-file'
                                                onClick={(e) => { e.stopPropagation(); handleClearFile(fIdx); }}
                                            />
                                        </div>
                                        <div className="excel-file-sheets">
                                            {file.sheetIndices.map(sIdx => (
                                                <button
                                                    key={sIdx}
                                                    className={`excel-sheet-btn ${sIdx === activeSheet ? 'active' : ''}`}
                                                    onClick={(e) => { e.stopPropagation(); setActiveSheet(sIdx); }}
                                                >
                                                    {sheetNames[sIdx]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="excel-toolbar-right">
                        {hasData && (
                            <div className="history-controls">
                                <button
                                    className="excel-toolbar-btn ghost square"
                                    onClick={undo}
                                    disabled={historyIndex <= 0}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <i className='bx bx-undo' />
                                </button>
                                <button
                                    className="excel-toolbar-btn ghost square"
                                    onClick={redo}
                                    disabled={historyIndex >= history.length - 1}
                                    title="Redo (Ctrl+Y)"
                                >
                                    <i className='bx bx-redo' />
                                </button>
                            </div>
                        )}

                        {hasData && (cellStyles[activeSheet] && Object.keys(cellStyles[activeSheet]).length > 0) && (
                            <button className="excel-toolbar-btn danger" onClick={() => {
                                const nextStyles = [...cellStyles];
                                nextStyles[activeSheet] = {};
                                setCellStyles(nextStyles);
                                saveToHistory(sheetsData, nextStyles);
                            }}>
                                <i className='bx bx-eraser' /> Clear Styles
                            </button>
                        )}
                        <label className="excel-toolbar-btn primary" style={{ cursor: 'pointer' }}>
                            <i className='bx bx-plus' />
                            Add File
                            <input
                                type="file"
                                accept=".xlsx,.xls,.csv,.ods"
                                multiple
                                hidden
                                onChange={handleFileChange}
                                ref={fileRef}
                            />
                        </label>

                        {hasData && (
                            <button className="excel-toolbar-btn success" onClick={downloadExcel}>
                                <i className='bx bx-download' />
                                Download
                            </button>
                        )}
                    </div>
                </div>

                {/* Upload zone or Spreadsheet */}
                {!hasData ? (
                    <div className="excel-upload-zone">
                        <div
                            className={`upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                        >
                            <i className='bx bx-cloud-upload upload-dropzone-icon' />
                            <h3>Drop your spreadsheet here</h3>
                            <p>or click to browse</p>
                            <div className="supported">
                                <span>.xlsx</span><span>.xls</span><span>.csv</span><span>.ods</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <SpreadsheetCanvas
                            data={currentData}
                            onCellChange={handleCellChange}
                            changedRows={changedRows}
                            cellStyles={cellStyles[activeSheet] || {}}
                        />
                        <div className="excel-status-bar">
                            <div className="stat">
                                <i className='bx bx-table' />
                                <strong>{currentData.length}</strong> rows
                            </div>
                            <div className="stat">
                                <i className='bx bx-columns' />
                                <strong>{(currentData[0] || []).length}</strong> cols
                            </div>
                            {changedRows.length > 0 && (
                                <div className="stat" style={{ color: 'var(--excel-green)' }}>
                                    <i className='bx bx-check-circle' />
                                    AI updated {changedRows.length} row(s)
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
