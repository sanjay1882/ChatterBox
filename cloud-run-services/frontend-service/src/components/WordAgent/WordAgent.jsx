import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { wordAgentStream } from '../../services/api';
import MessageBubble from '../Chat/MessageBubble';
import { formatStreamedText } from '../../utils/formatStreamedText';
import { highlightAllCodeBlocks } from '../../utils/markdown';
import * as mammoth from 'mammoth';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const QUICK_PROMPTS = [
    'Summarize this document',
    'Fix grammar & spelling',
    'Make it more professional',
    'Add an executive summary',
    'Expand with more detail',
    'Convert to bullet points',
    'Rewrite in simpler language',
    'Add a conclusion',
];

const WELCOME_MESSAGE = {
    role: 'ai',
    content: 'Upload a `.docx` or `.txt` file, or start from a blank document. I can write, rewrite, summarize, format, and edit — just tell me what you need.',
};

export default function WordAgent({ initialFile, onClearFile }) {
    const { user, token } = useAuth();
    // ── Document State ──
    const [docContent, setDocContent] = useState('');         // plain text content
    const [docHtml, setDocHtml] = useState('');               // rendered HTML for preview
    const [fileName, setFileName] = useState('');
    const [openFiles, setOpenFiles] = useState([]);           // [{ name, content }]
    const [activeFile, setActiveFile] = useState(0);
    const [wordCount, setWordCount] = useState(0);
    const [charCount, setCharCount] = useState(0);
    const [isDirty, setIsDirty] = useState(false);

    // ── Chat State ──
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);

    // ── History (Undo/Redo) ──
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // ── UI State ──
    const [isDragOver, setIsDragOver] = useState(false);
    const [chatWidth, setChatWidth] = useState(360);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [mobileTab, setMobileTab] = useState('chat');
    const [highlightedLines, setHighlightedLines] = useState([]); // lines AI changed
    const [changedSection, setChangedSection] = useState(null);

    const parsedFilesRef = useRef(new Set());
    const fileRef = useRef(null);
    const msgsBottom = useRef(null);
    const editorRef = useRef(null);
    const previewRef = useRef(null);

    // ── Responsive ──
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ── Scroll chat to bottom ──
    useEffect(() => {
        msgsBottom.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    // ── Word/char counts ──
    useEffect(() => {
        const text = docContent || '';
        const plainText = text.replace(/<[^>]*>?/gm, ''); // strip HTML tags
        setWordCount(plainText.trim() ? plainText.trim().split(/\s+/).length : 0);
        setCharCount(plainText.length);
    }, [docContent]);

    // ── Highlight code blocks ──
    useEffect(() => {
        const container = document.querySelector('.word-messages');
        if (container) {
            highlightAllCodeBlocks(container);
        }
    }, [messages, isThinking]);

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [historyIndex, history]);

    // ── Initial file from parent ──
    useEffect(() => {
        if (initialFile && !parsedFilesRef.current.has(initialFile.name)) {
            parseFile(initialFile);
        }
    }, [initialFile]);

    // ── Resizer Logic ──
    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => setIsResizing(false), []);

    const doResizing = useCallback((e) => {
        if (isResizing) {
            const w = e.clientX;
            if (w > 280 && w < 800) setChatWidth(w);
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

    // ── History ──
    const saveToHistory = (content) => {
        setHistory(prev => {
            const next = prev.slice(0, historyIndex + 1);
            next.push(content);
            if (next.length > 50) next.shift();
            return next;
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
    };

    const undo = () => {
        if (historyIndex <= 0) return;
        const prev = history[historyIndex - 1];
        setDocContent(prev);
        setHistoryIndex(h => h - 1);
        setIsDirty(true);
    };

    const redo = () => {
        if (historyIndex >= history.length - 1) return;
        const next = history[historyIndex + 1];
        setDocContent(next);
        setHistoryIndex(h => h + 1);
        setIsDirty(true);
    };

    // ── File Parsing ──
    // TODO: wire up backend mammoth/docx parser here
    const parseFile = (file) => {
        if (parsedFilesRef.current.has(file.name)) {
            setMessages(prev => [...prev, {
                role: 'ai',
                content: `⚠️ **${file.name}** is already open.`,
            }]);
            return;
        }
        parsedFilesRef.current.add(file.name);

        const reader = new FileReader();
        reader.onload = async (e) => {
            let content = '';
            if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
                // Convert plain text to simple paragraphs for Quill
                const lines = e.target.result.split('\n');
                content = lines.map(line => `<p>${line.trim()}</p>`).join('');
            } else if (file.name.endsWith('.docx')) {
                try {
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    content = result.value || '';
                } catch (error) {
                    console.error('Error parsing docx:', error);
                    content = `[Error parsing DOCX: ${error.message}]`;
                }
            }

            const newFile = { name: file.name, content };

            setOpenFiles(prev => {
                if (prev.some(f => f.name === file.name)) return prev;
                const updated = [...prev, newFile];
                setActiveFile(updated.length - 1);
                return updated;
            });

            setDocContent(content);
            setFileName(file.name);
            setIsDirty(false);
            saveToHistory(content);

            setMessages(prev => [...prev, {
                role: 'ai',
                content: `✅ Opened **${file.name}** — ${content.trim().split(/\s+/).length} words loaded.`,
                op: 'file-loaded'
            }]);
        };

        if (file.name.endsWith('.docx')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        files.forEach(parseFile);
        if (e.target) e.target.value = null;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        Array.from(e.dataTransfer.files || []).forEach(parseFile);
    };

    const handleClearFile = (fileIndex) => {
        if (fileIndex === undefined) {
            setOpenFiles([]);
            setDocContent('');
            setDocHtml('');
            setFileName('');
            setActiveFile(0);
            setHistory([]);
            setHistoryIndex(-1);
            setIsDirty(false);
            parsedFilesRef.current.clear();
            onClearFile?.();
            return;
        }
        const removed = openFiles[fileIndex];
        parsedFilesRef.current.delete(removed.name);
        const updated = openFiles.filter((_, i) => i !== fileIndex);
        setOpenFiles(updated);

        const newActive = Math.max(0, fileIndex - 1);
        setActiveFile(newActive);
        if (updated.length > 0) {
            setDocContent(updated[newActive].content);
            setFileName(updated[newActive].name);
        } else {
            setDocContent('');
            setFileName('');
        }
    };

    const switchFile = (idx) => {
        setActiveFile(idx);
        setDocContent(openFiles[idx].content);
        setFileName(openFiles[idx].name);
        setIsDirty(false);
    };

    const handleEditorChange = (content) => {
        setDocContent(content);
        setIsDirty(true);
    };

    const handleEditorBlur = () => {
        saveToHistory(docContent);
        // sync to openFiles
        setOpenFiles(prev => prev.map((f, i) =>
            i === activeFile ? { ...f, content: docContent } : f
        ));
    };

    // ReactQuill modules config
    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
    };

    // ── AI Chat ──
    const sendMessage = async (msgText) => {
        const txt = msgText ?? input.trim();
        if (!txt || isThinking) return;
        setInput('');

        const userMsg = { role: 'user', content: txt };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        const aiMsgId = Date.now();
        setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMsgId }]);

        let accumulatedContent = "";

        try {
            await wordAgentStream({
                message: txt,
                docContent,
                fileName,
                token: token || 'guest',
                email: user?.email || 'guest@treevit.local',
                onChunk: (chunk) => {
                    accumulatedContent += chunk;
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: accumulatedContent } : m
                    ));
                },
                onData: (data) => {
                    if (data.fullMessage) {
                        setMessages(prev => prev.map(m =>
                            m.id === aiMsgId ? { ...m, content: data.fullMessage } : m
                        ));
                    }
                    if (data.updatedDoc) {
                        applyDocUpdate(data.updatedDoc, data.changedLines || []);
                    }
                }
            });
        } catch (err) {
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId
                    ? { ...m, content: `⚠️ Error: ${err.message || 'Something went wrong'}` }
                    : m
            ));
        } finally {
            setIsThinking(false);
        }
    };

    // ── Apply AI doc update ──
    // Call this from your backend handler when updatedDoc arrives
    const applyDocUpdate = useCallback((newContent, changedLineNumbers = []) => {
        saveToHistory(docContent);
        setDocContent(newContent);
        setHighlightedLines(changedLineNumbers);
        setIsDirty(true);
        setOpenFiles(prev => prev.map((f, i) =>
            i === activeFile ? { ...f, content: newContent } : f
        ));
        setTimeout(() => setHighlightedLines([]), 2500);
    }, [docContent, activeFile]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ── Download ──
    // TODO: wire backend .docx export if needed
    const downloadTxt = () => {
        // Wrap the HTML content in a basic HTML structure so it's recognized properly when saved as .doc
        const exportHtml = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Export Document</title></head>
            <body>${docContent}</body>
            </html>
        `;
        const blob = new Blob(['\ufeff', exportHtml], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const exportName = fileName.replace(/\.[^/.]+$/, "") + ".doc";
        a.download = fileName === 'Untitled Document' ? 'document.doc' : exportName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const hasDoc = docContent.length > 0 || openFiles.length > 0;

    const chatStyle = isMobile
        ? { display: mobileTab === 'chat' ? 'flex' : 'none', width: '100%', minWidth: '100%' }
        : { width: chatWidth, minWidth: chatWidth };

    const canvasStyle = isMobile
        ? { display: mobileTab === 'doc' ? 'flex' : 'none', width: '100%', minWidth: '100%' }
        : {};

    return (
        <div className={`word-agent ${isResizing ? 'is-resizing' : ''} ${isMobile ? 'is-mobile' : ''}`}>

            {/* ── Mobile Tabs ── */}
            {isMobile && (
                <div className="word-mobile-tabs">
                    <button
                        className={`word-mobile-tab ${mobileTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setMobileTab('chat')}
                    >
                        <i className='bx bx-message-rounded-dots' /> Chat
                    </button>
                    <button
                        className={`word-mobile-tab ${mobileTab === 'doc' ? 'active' : ''}`}
                        onClick={() => setMobileTab('doc')}
                    >
                        <i className='bx bx-file-blank' /> Document
                        {hasDoc && <span className="mobile-doc-badge" />}
                    </button>
                </div>
            )}

            {/* ── Left: Chat Panel ── */}
            <div className="word-chat-panel" style={chatStyle}>
                <div className="word-chat-header">
                    <div className="word-chat-header-icon">
                        <i className='bx bxs-file-doc' />
                    </div>
                    <div>
                        <h3>Word Agent</h3>
                        <p>AI-powered document editor</p>
                    </div>
                </div>

                <div className="word-messages">
                    {messages.map((msg, i) => (
                        <div key={msg.id || i} className="word-message-wrapper">
                            <MessageBubble
                                msg={msg}
                                userPhoto={user?.photoURL}
                                userInitial={user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                                isStreaming={isThinking && i === messages.length - 1}
                            />
                            {msg.op && msg.op !== 'file-loaded' && (
                                <div className="word-op-badge" style={{ marginLeft: 50 }}>
                                    <i className='bx bx-check-circle' />
                                    {msg.op}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={msgsBottom} />
                </div>

                <div className="word-chat-input-area">
                    <div className="word-quick-prompts">
                        {QUICK_PROMPTS.map((p, i) => (
                            <span
                                key={i}
                                className="word-chip"
                                onClick={() => sendMessage(p)}
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                    <div className="word-chat-box">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tell the AI what to do with your document..."
                            rows={2}
                        />
                        <button
                            className="word-send-btn"
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

            {/* ── Resizer ── */}
            {!isMobile && (
                <div className={`word-resizer ${isResizing ? 'active' : ''}`} onMouseDown={startResizing}>
                    <div className="resizer-handle" />
                </div>
            )}

            {/* ── Right: Document Canvas ── */}
            <div className="word-canvas" style={canvasStyle}>

                {/* Toolbar */}
                <div className="word-toolbar">
                    <div className="word-toolbar-left">
                        {openFiles.length > 0 && (
                            <div className="word-files-list">
                                {openFiles.map((file, fIdx) => (
                                    <div
                                        key={fIdx}
                                        className={`word-file-tab ${fIdx === activeFile ? 'active' : ''}`}
                                        onClick={() => switchFile(fIdx)}
                                    >
                                        <i className='bx bxs-file-doc' />
                                        <span>{file.name}</span>
                                        <i
                                            className='bx bx-x close-file'
                                            onClick={(e) => { e.stopPropagation(); handleClearFile(fIdx); }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="word-toolbar-right">
                        {/* Undo / Redo */}
                        {hasDoc && (
                            <div className="history-controls">
                                <button
                                    className="word-toolbar-btn ghost square"
                                    onClick={undo}
                                    disabled={historyIndex <= 0}
                                    title="Undo (Ctrl+Z)"
                                >
                                    <i className='bx bx-undo' />
                                </button>
                                <button
                                    className="word-toolbar-btn ghost square"
                                    onClick={redo}
                                    disabled={historyIndex >= history.length - 1}
                                    title="Redo (Ctrl+Y)"
                                >
                                    <i className='bx bx-redo' />
                                </button>
                            </div>
                        )}

                        {/* Add file */}
                        <label className="word-toolbar-btn primary" style={{ cursor: 'pointer' }}>
                            <i className='bx bx-plus' />
                            Add File
                            <input
                                type="file"
                                accept=".txt,.docx,.md"
                                multiple
                                hidden
                                onChange={handleFileChange}
                                ref={fileRef}
                            />
                        </label>

                        {/* Download */}
                        {hasDoc && (
                            <button className="word-toolbar-btn success" onClick={downloadTxt}>
                                <i className='bx bx-download' />
                                Download
                            </button>
                        )}
                    </div>
                </div>

                {/* Document body */}
                {!hasDoc ? (
                    <div className="word-upload-zone">
                        <div
                            className={`upload-dropzone ${isDragOver ? 'drag-over' : ''}`}
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                        >
                            <i className='bx bx-cloud-upload upload-dropzone-icon' />
                            <h3>Drop your document here</h3>
                            <p>or click to browse</p>
                            <div className="supported">
                                <span>.docx</span><span>.txt</span><span>.md</span>
                            </div>
                        </div>

                        <button
                            className="word-toolbar-btn ghost blank-doc-btn"
                            onClick={() => {
                                setDocContent('');
                                setFileName('Untitled Document');
                                setOpenFiles([{ name: 'Untitled Document', content: '' }]);
                                setActiveFile(0);
                            }}
                        >
                            <i className='bx bx-file-blank' /> Start with blank document
                        </button>
                    </div>
                ) : (
                    <div className="word-editor-area">
                        <div className="word-doc-paper-wrapper">
                            <div className="word-doc-paper">
                                <ReactQuill
                                    theme="snow"
                                    value={docContent}
                                    onChange={handleEditorChange}
                                    onBlur={handleEditorBlur}
                                    modules={quillModules}
                                    placeholder="Start writing here..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Status bar */}
                {hasDoc && (
                    <div className="word-status-bar">
                        <div className="stat">
                            <i className='bx bx-text' />
                            <strong>{wordCount}</strong> words
                        </div>
                        <div className="stat">
                            <i className='bx bx-font' />
                            <strong>{charCount}</strong> chars
                        </div>
                        {isDirty && (
                            <div className="stat dirty">
                                <i className='bx bx-pencil' />
                                Unsaved changes
                            </div>
                        )}
                        {highlightedLines.length > 0 && (
                            <div className="stat ai-updated">
                                <i className='bx bx-check-circle' />
                                AI updated document
                            </div>
                        )}
                        <div className="stat filename">
                            <i className='bx bxs-file-doc' />
                            {fileName}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
