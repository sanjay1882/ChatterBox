
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    HardDrive, FolderOpen, File, FileText, FileSpreadsheet,
    PanelLeftOpen, PanelLeftClose, X, Search, Plus,
    Trash2, Trash, Move, Copy, Share2, Star, Edit3,
    ArrowUp, Loader2, FolderPlus, Eye, MoreHorizontal,
    Database, Grid3X3, List, RefreshCw, Layers,
    AlertCircle, CheckCircle2, Info, FolderSearch,
    ChevronRight, Clock, Sparkles, PenLine, Undo2, Redo2,
    PanelRight, FileSearch, CloudOff, CloudCheck,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { googleDriveAgentStream } from '../../services/api';
import MessageBubble from '../Chat/MessageBubble';


// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

const MIME_MAP = {
    'application/vnd.google-apps.folder':       { icon: FolderOpen,      color: '#f59e0b', label: 'Folder'       },
    'application/vnd.google-apps.document':     { icon: FileText,        color: '#4285f4', label: 'Doc'          },
    'application/vnd.google-apps.spreadsheet':  { icon: FileSpreadsheet, color: '#34a853', label: 'Sheet'        },
    'application/vnd.google-apps.presentation': { icon: File,            color: '#ea4335', label: 'Slides'       },
    'application/pdf':                          { icon: FileText,        color: '#dc2626', label: 'PDF'          },
    'image/jpeg':                               { icon: File,            color: '#8b5cf6', label: 'Image'        },
    'image/png':                                { icon: File,            color: '#8b5cf6', label: 'Image'        },
    'default':                                  { icon: File,            color: '#6b7280', label: 'File'         },
};

function getMime(mimeType = '') {
    return MIME_MAP[mimeType] || MIME_MAP['default'];
}

function fmt_bytes(b) {
    if (!b) return '';
    const n = parseInt(b);
    if (n < 1024)       return `${n} B`;
    if (n < 1048576)    return `${(n/1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n/1048576).toFixed(1)} MB`;
    return `${(n/1073741824).toFixed(2)} GB`;
}

function fmt_date(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const WELCOME = {
    role: 'ai',
    content: `Hi! I'm your **Google Drive Assistant** 🗂️

I understand natural language — just tell me what you need:

- *"Find all files related to budget"* → deep search across names & content
- *"Show my recent files"* → list your Drive
- *"Create a folder called Q4 Reports"* → instant creation
- *"Summarize the file named Project Plan"* → read & explain
- *"Share report.xlsx with john@email.com"* → manage permissions
- *"How much storage am I using?"* → quota check

I also **remember our conversation**, so you can say things like *"now rename that file"* or *"trash the second one"*.

What would you like to do?`,
};

const QUICK_PROMPTS = [
    { icon: Clock,       label: 'Recent files',   prompt: 'Show my recent files'                    },
    { icon: FileSearch,  label: 'Deep search',    prompt: 'Find all files related to '              },
    { icon: FolderPlus,  label: 'New folder',     prompt: 'Create a new folder called '             },
    { icon: Database,    label: 'Storage',        prompt: 'How much storage am I using?'            },
    { icon: Star,        label: 'Starred',        prompt: 'Show my starred files'                   },
    { icon: Share2,      label: 'Shared',         prompt: 'Show files shared with me'               },
];

// ─────────────────────────────────────
// Storage Bar
// ─────────────────────────────────────
function StorageBar({ used, limit }) {
    const pct   = limit ? Math.min((parseInt(used) / parseInt(limit)) * 100, 100) : 0;
    const color = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#34a853';
    return (
        <div className="gda-storage">
            <div className="gda-storage-track">
                <div className="gda-storage-fill" style={{ width: `${pct.toFixed(1)}%`, background: color }} />
            </div>
            <div className="gda-storage-labels">
                <span>{fmt_bytes(used)} used</span>
                <span>{pct.toFixed(0)}%</span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────
// File Row (list view)
// ─────────────────────────────────────
function FileRow({ file, selected, onSelect, onQuickAction }) {
    const { icon: Icon, color } = getMime(file.mimeType);
    return (
        <div
            className={`gda-frow ${selected ? 'sel' : ''}`}
            onClick={() => onSelect(file.id)}
            onDoubleClick={() => file.webViewLink && window.open(file.webViewLink, '_blank')}
        >
            <Icon size={15} color={color} strokeWidth={1.8} className="gda-frow-ico" />
            <div className="gda-frow-info">
                <span className="gda-frow-name">{file.name}</span>
                {file._inFolder && <span className="gda-frow-folder">in {file._inFolder}</span>}
            </div>
            <span className="gda-frow-size">{fmt_bytes(file.size)}</span>
            <span className="gda-frow-date">{fmt_date(file.modifiedTime)}</span>
            <button
                className="gda-frow-more"
                onClick={e => { e.stopPropagation(); onQuickAction(file); }}
            >
                <MoreHorizontal size={13} strokeWidth={2} />
            </button>
        </div>
    );
}

// ─────────────────────────────────────
// File Grid Card
// ─────────────────────────────────────
function FileGridCard({ file, selected, onSelect, onQuickAction }) {
    const { icon: Icon, color, label } = getMime(file.mimeType);
    return (
        <div
            className={`gda-fcard ${selected ? 'sel' : ''}`}
            onClick={() => onSelect(file.id)}
            onDoubleClick={() => file.webViewLink && window.open(file.webViewLink, '_blank')}
        >
            <div className="gda-fcard-ico">
                <Icon size={26} color={color} strokeWidth={1.6} />
                {file.starred && <Star size={9} color="#f59e0b" fill="#f59e0b" className="gda-fcard-star" />}
            </div>
            <span className="gda-fcard-name">{file.name}</span>
            <span className="gda-fcard-type">{label}</span>
            <button
                className="gda-fcard-more"
                onClick={e => { e.stopPropagation(); onQuickAction(file); }}
            >
                <MoreHorizontal size={12} strokeWidth={2} />
            </button>
        </div>
    );
}

// ─────────────────────────────────────
// Toast
// ─────────────────────────────────────
function ToastStack({ toasts, onDismiss }) {
    return (
        <div className="gda-toasts">
            {toasts.map(t => (
                <div key={t.id} className={`gda-toast gda-toast-${t.type}`}>
                    {t.type === 'success' && <CheckCircle2 size={14} strokeWidth={2} />}
                    {t.type === 'error'   && <AlertCircle  size={14} strokeWidth={2} />}
                    {t.type === 'info'    && <Info         size={14} strokeWidth={2} />}
                    <span>{t.message}</span>
                    <button onClick={() => onDismiss(t.id)}><X size={12} strokeWidth={2.5} /></button>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────
// File context menu
// ─────────────────────────────────────
function FileMenu({ file, onAction, onClose }) {
    const { icon: Icon, color } = getMime(file.mimeType);
    const items = [
        { icon: Eye,      label: 'Open in Drive',  action: 'open',      hide: !file.webViewLink },
        { icon: FileText, label: 'Summarize',       action: 'summarize'  },
        { icon: Share2,   label: 'Share',           action: 'share'      },
        { icon: Star,     label: file.starred ? 'Unstar' : 'Star', action: 'star' },
        { icon: Edit3,    label: 'Rename',          action: 'rename'     },
        { icon: Copy,     label: 'Make a copy',     action: 'copy'       },
        { icon: Trash,    label: 'Move to trash',   action: 'trash',  danger: true },
    ];
    return (
        <div className="gda-menu" onClick={e => e.stopPropagation()}>
            <div className="gda-menu-header">
                <Icon size={14} color={color} strokeWidth={1.8} />
                <span className="gda-menu-name">{file.name}</span>
                <button onClick={onClose}><X size={13} strokeWidth={2} /></button>
            </div>
            <div className="gda-menu-items">
                {items.filter(i => !i.hide).map(({ icon: IIcon, label, action, danger }) => (
                    <button
                        key={action}
                        className={`gda-menu-item ${danger ? 'danger' : ''}`}
                        onClick={() => { onAction(action, file); onClose(); }}
                    >
                        <IIcon size={13} strokeWidth={1.9} />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────
// Main Component
// ─────────────────────────────────────
export default function GoogleDriveAgent({ settings }) {
    const { user, token, googleConnected, googleAccessToken, getFreshToken } = useAuth();

    // Chat state
    const [messages,         setMessages]         = useState([WELCOME]);
    const [conversationHistory, setConvHistory]   = useState([]); // ← sent to backend
    const [input,            setInput]            = useState('');
    const [isThinking,       setIsThinking]       = useState(false);
    const [sessionId,        setSessionId]        = useState(null);

    // Drive state
    const [driveContent,     setDriveContent]     = useState([]);
    const [searchMeta,       setSearchMeta]       = useState(null); // {keyword, totalFound}
    const [quota,            setQuota]            = useState(null);
    const [selectedId,       setSelectedId]       = useState(null);
    const [menuFile,         setMenuFile]         = useState(null);

    // UI state
    const [sidebarOpen,      setSidebarOpen]      = useState(false);
    const [explorerOpen,     setExplorerOpen]     = useState(true);
    const [viewMode,         setViewMode]         = useState('list');
    const [activeFilter,     setActiveFilter]     = useState('all');
    const [toasts,           setToasts]           = useState([]);

    // History (undo/redo for drive content)
    const [driveHistory,     setDriveHistory]     = useState([[]]);
    const [driveHistIdx,     setDriveHistIdx]     = useState(0);

    const msgsEndRef  = useRef(null);
    const textareaRef = useRef(null);
    const menuRef     = useRef(null);

    useEffect(() => {
        msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFile(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Toast ──
    const toast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, message, type }]);
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
    }, []);

    // ── Drive history ──
    const saveDriveHistory = (next) => {
        setDriveHistory(h => {
            const sliced = h.slice(0, driveHistIdx + 1);
            sliced.push(next);
            setDriveHistIdx(sliced.length - 1);
            return sliced;
        });
    };

    const undo = () => {
        if (driveHistIdx > 0) {
            const i = driveHistIdx - 1;
            setDriveHistIdx(i);
            setDriveContent(driveHistory[i]);
        }
    };

    const redo = () => {
        if (driveHistIdx < driveHistory.length - 1) {
            const i = driveHistIdx + 1;
            setDriveHistIdx(i);
            setDriveContent(driveHistory[i]);
        }
    };

    // ── Handle actions from agent ──
    const handleActions = useCallback((actions) => {
        let nextContent = null;

        actions.forEach(action => {
            switch (action.type) {
                case 'list':
                    if (Array.isArray(action.results) && action.results.length > 0) {
                        nextContent = action.results;
                        setSearchMeta(null);
                    }
                    break;

                case 'search':
                    if (Array.isArray(action.results)) {
                        nextContent = action.results;
                        setSearchMeta({
                            keyword:    action.keyword,
                            totalFound: action.totalFound || action.results.length,
                        });
                    }
                    break;

                case 'quota':
                    setQuota(action);
                    break;

                case 'create':
                    if (action.result?.id) {
                        setDriveContent(prev => {
                            const next = [action.result, ...prev];
                            saveDriveHistory(next);
                            return next;
                        });
                        toast(`Created "${action.result.name}"`, 'success');
                    }
                    break;

                case 'rename':
                    setDriveContent(prev => {
                        const next = prev.map(f =>
                            f.id === action.fileId ? { ...f, name: action.newName } : f
                        );
                        saveDriveHistory(next);
                        return next;
                    });
                    if (action.newName) toast(`Renamed to "${action.newName}"`, 'success');
                    break;

                case 'trash':
                    setDriveContent(prev => {
                        const next = prev.filter(f => f.id !== action.fileId);
                        saveDriveHistory(next);
                        return next;
                    });
                    toast(`"${action.name || 'File'}" moved to trash`, 'info');
                    break;

                case 'delete':
                    setDriveContent(prev => {
                        const next = prev.filter(f => f.id !== action.fileId);
                        saveDriveHistory(next);
                        return next;
                    });
                    toast(`File permanently deleted`, 'success');
                    break;

                case 'star':
                    setDriveContent(prev => prev.map(f =>
                        f.id === action.fileId ? { ...f, starred: action.starred } : f
                    ));
                    toast(action.starred ? '⭐ File starred' : 'Star removed', 'info');
                    break;

                case 'copy':
                    if (action.result?.id) {
                        setDriveContent(prev => {
                            const next = [action.result, ...prev];
                            saveDriveHistory(next);
                            return next;
                        });
                        toast(`Copied as "${action.result.name}"`, 'success');
                    }
                    break;

                case 'share':
                    toast(`Shared with ${action.email} (${action.role})`, 'success');
                    break;

                case 'error':
                    toast(action.message, 'error');
                    break;

                default: break;
            }
        });

        if (nextContent !== null) {
            setDriveContent(nextContent);
            saveDriveHistory(nextContent);
            // auto-open explorer
            setExplorerOpen(true);
        }
    }, [toast]);

    // ── Textarea resize ──
    const resizeTa = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 130) + 'px';
    };

    // ── Send message ──
    const sendMessage = async (textOverride) => {
        if (!googleConnected) {
            setMessages(prev => [...prev, {
                role: 'ai',
                content: "⚠️ **Please connect your Google account first.** Click 'Connect Google' in the Apps menu.",
            }]);
            return;
        }

        const msgText = (textOverride || input).trim();
        if (!msgText || isThinking) return;

        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setMenuFile(null);

        // Add to UI messages
        const userMsg = { role: 'user', content: msgText };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        const aiMsgId = Date.now();
        setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMsgId }]);

        // Build conversation history to send to backend
        // Include all previous REAL messages (not the welcome)
        const historyToSend = conversationHistory.slice(-16); // last 8 exchanges

        let accumulated = '';
        try {
            const activeToken = await getFreshToken();
            await googleDriveAgentStream({
                message:             msgText,
                driveContent:        driveContent,
                conversationHistory: historyToSend,  // ← KEY: send history
                token:               activeToken,
                email:               user?.email,
                googleAccessToken,
                sessionId,
                settings,
                onSessionId: (id) => setSessionId(id),
                onChunk: (chunk) => {
                    accumulated += chunk;
                    setMessages(prev =>
                        prev.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m)
                    );
                },
                onData: (data) => {
                    if (data.fullMessage) {
                        accumulated = data.fullMessage;
                        setMessages(prev =>
                            prev.map(m => m.id === aiMsgId ? { ...m, content: data.fullMessage } : m)
                        );
                    }
                    if (data.actions?.length > 0) {
                        handleActions(data.actions);
                    }
                },
            });

            // After response: update conversation history for next turn
            setConvHistory(prev => [
                ...prev,
                { role: 'user',      content: msgText     },
                { role: 'assistant', content: accumulated  },
            ]);

        } catch (err) {
            setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, content: `Sorry, something went wrong: ${err.message}` } : m)
            );
        } finally {
            setIsThinking(false);
        }
    };

    // ── Menu actions → send natural language to agent ──
    const handleMenuAction = (action, file) => {
        const prompts = {
            open:      () => file.webViewLink && window.open(file.webViewLink, '_blank'),
            summarize: () => sendMessage(`Summarize the file named "${file.name}" with ID ${file.id}`),
            share:     () => sendMessage(`I want to share "${file.name}" — ask me for the email`),
            star:      () => sendMessage(`${file.starred ? 'Unstar' : 'Star'} the file "${file.name}" with ID ${file.id}`),
            rename:    () => sendMessage(`Rename the file "${file.name}" with ID ${file.id} — ask me for the new name`),
            copy:      () => sendMessage(`Make a copy of "${file.name}" with ID ${file.id}`),
            trash:     () => sendMessage(`Move "${file.name}" with ID ${file.id} to trash`),
        };
        if (action === 'open') {
            prompts.open();
        } else {
            prompts[action]?.();
        }
    };

    // ── Filtered files ──
    const filteredFiles = driveContent.filter(f => {
        if (activeFilter === 'folders') return f.mimeType?.includes('folder');
        if (activeFilter === 'docs')    return f.mimeType?.includes('document');
        if (activeFilter === 'sheets')  return f.mimeType?.includes('spreadsheet');
        if (activeFilter === 'starred') return f.starred;
        return true;
    });

    const selectedFile = driveContent.find(f => f.id === selectedId);

    const NAV = [
        { icon: HardDrive,       label: 'All Files', filter: 'all'     },
        { icon: FolderOpen,      label: 'Folders',   filter: 'folders' },
        { icon: FileText,        label: 'Docs',      filter: 'docs'    },
        { icon: FileSpreadsheet, label: 'Sheets',    filter: 'sheets'  },
        { icon: Star,            label: 'Starred',   filter: 'starred' },
    ];

    return (
        <div className="gda-root" onClick={() => menuFile && setMenuFile(null)}>

            {/* ══ Sidebar ══ */}
            <aside className={`gda-sidebar ${sidebarOpen ? '' : 'closed'}`}>
                <div className="gda-sb-head">
                    <div className="gda-brand">
                        <div className="gda-brand-ico">
                            <HardDrive size={15} color="#fff" strokeWidth={2.2} />
                        </div>
                        Drive AI
                    </div>
                    <button className="gda-ico-btn" onClick={() => setSidebarOpen(false)}>
                        <X size={15} strokeWidth={2} />
                    </button>
                </div>

                <div className="gda-sb-body">
                    <div className="gda-nav">
                        {NAV.map(({ icon: Icon, label, filter }) => (
                            <div
                                key={filter}
                                className={`gda-nav-item ${activeFilter === filter ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveFilter(filter);
                                    if (window.innerWidth < 768) setSidebarOpen(false);
                                }}
                            >
                                <Icon size={15} strokeWidth={activeFilter === filter ? 2.2 : 1.75} />
                                <span>{label}</span>
                                {filter === 'all' && driveContent.length > 0 && (
                                    <span className="gda-nav-badge">{driveContent.length}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {quota && (
                        <div className="gda-sb-section">
                            <div className="gda-sb-label">Storage</div>
                            <StorageBar used={quota.used} limit={quota.limit} />
                            <span className="gda-sb-quota-detail">of {fmt_bytes(quota.limit)} total</span>
                        </div>
                    )}

                    <div className="gda-sb-section">
                        <div className="gda-sb-label">Quick Actions</div>
                        {[
                            { icon: RefreshCw,   label: 'Refresh files',  prompt: 'Show my recent files'         },
                            { icon: Database,    label: 'Check storage',  prompt: 'How much storage am I using?' },
                            { icon: Star,        label: 'Starred files',  prompt: 'Show my starred files'        },
                        ].map(({ icon: Icon, label, prompt }) => (
                            <button key={label} className="gda-sb-action" onClick={() => {
                                setSidebarOpen(false);
                                sendMessage(prompt);
                            }}>
                                <Icon size={13} strokeWidth={1.8} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {sidebarOpen && <div className="gda-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* ══ Main ══ */}
            <div className="gda-main">

                {/* Topbar */}
                <header className="gda-topbar">
                    <div className="gda-tb-left">
                        <button
                            className={`gda-ico-btn ${sidebarOpen ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(v => !v)}
                            title="Toggle sidebar"
                        >
                            {sidebarOpen
                                ? <PanelLeftClose size={15} strokeWidth={1.9} />
                                : <PanelLeftOpen  size={15} strokeWidth={1.9} />
                            }
                        </button>
                        <span className="gda-tb-title">
                            {NAV.find(n => n.filter === activeFilter)?.label || 'Drive AI'}
                        </span>
                        {searchMeta && (
                            <span className="gda-search-badge">
                                <FileSearch size={11} strokeWidth={2} />
                                {searchMeta.totalFound} results for "{searchMeta.keyword}"
                            </span>
                        )}
                    </div>

                    <div className="gda-tb-right">
                        <button className="gda-ico-btn" onClick={undo} disabled={driveHistIdx === 0} title="Undo">
                            <Undo2 size={14} strokeWidth={2} />
                        </button>
                        <button className="gda-ico-btn" onClick={redo} disabled={driveHistIdx >= driveHistory.length - 1} title="Redo">
                            <Redo2 size={14} strokeWidth={2} />
                        </button>

                        <div className="gda-sep" />

                        <div className="gda-status">
                            {googleConnected
                                ? <><CloudCheck size={13} strokeWidth={2} color="#34a853" /> <span>Connected</span></>
                                : <><CloudOff   size={13} strokeWidth={2} color="#ccc"    /> <span>Disconnected</span></>
                            }
                        </div>

                        <div className="gda-sep" />

                        <button
                            className={`gda-explorer-btn ${explorerOpen ? 'open' : ''}`}
                            onClick={() => setExplorerOpen(v => !v)}
                        >
                            <PanelRight size={13} strokeWidth={2} />
                            <span>{explorerOpen ? 'Hide Explorer' : 'Explorer'}</span>
                        </button>
                    </div>
                </header>

                {/* Body: chat + explorer */}
                <div className="gda-body">

                    {/* ── Chat column ── */}
                    <div className="gda-chat">
                        <div className="gda-msgs" ref={null}>
                            {messages.map((msg, i) => (
                                <MessageBubble
                                    key={i}
                                    msg={msg}
                                    userPhoto={user?.photoURL}
                                    isStreaming={isThinking && i === messages.length - 1}
                                />
                            ))}
                            {isThinking && (
                                <div className="gda-typing">
                                    <div className="gda-typing-av">
                                        <HardDrive size={12} strokeWidth={2.2} color="#fff" />
                                    </div>
                                    <div className="gda-typing-dots">
                                        <span /><span /><span />
                                    </div>
                                </div>
                            )}
                            <div ref={msgsEndRef} />
                        </div>

                        {/* Input */}
                        <div className="gda-input-wrap">
                            <div className="gda-chips">
                                {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                                    <button
                                        key={label}
                                        className="gda-chip"
                                        onClick={() => {
                                            // For prompts ending in space, focus and pre-fill
                                            if (prompt.endsWith(' ')) {
                                                setInput(prompt);
                                                textareaRef.current?.focus();
                                            } else {
                                                sendMessage(prompt);
                                            }
                                        }}
                                    >
                                        <Icon size={12} strokeWidth={2} />
                                        <span>{label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="gda-input-box">
                                <PenLine size={15} strokeWidth={1.8} className="gda-input-icon" />
                                <textarea
                                    ref={textareaRef}
                                    rows={1}
                                    value={input}
                                    onChange={e => { setInput(e.target.value); resizeTa(); }}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendMessage();
                                        }
                                    }}
                                    placeholder="Ask anything about your Drive — I remember our conversation…"
                                />
                                <button
                                    className="gda-send"
                                    onClick={() => sendMessage()}
                                    disabled={isThinking || !input.trim()}
                                >
                                    {isThinking
                                        ? <span className="gda-spin"><Loader2 size={15} strokeWidth={2} /></span>
                                        : <ArrowUp size={15} strokeWidth={2.2} />
                                    }
                                </button>
                            </div>
                            <p className="gda-input-hint">
                                Press Enter to send · Shift+Enter for new line · I remember context from earlier in this conversation
                            </p>
                        </div>
                    </div>

                    {/* ── Explorer column ── */}
                    {explorerOpen && (
                        <aside className="gda-explorer">
                            {/* Explorer header */}
                            <div className="gda-exp-head">
                                <div className="gda-exp-head-l">
                                    <span className="gda-exp-title">
                                        {searchMeta ? `Search: "${searchMeta.keyword}"` : 'Explorer'}
                                    </span>
                                    {filteredFiles.length > 0 && (
                                        <span className="gda-exp-count">{filteredFiles.length}</span>
                                    )}
                                </div>
                                <div className="gda-exp-head-r">
                                    <button
                                        className={`gda-ico-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                        onClick={() => setViewMode('grid')} title="Grid view"
                                    >
                                        <Grid3X3 size={12} strokeWidth={2} />
                                    </button>
                                    <button
                                        className={`gda-ico-btn ${viewMode === 'list' ? 'active' : ''}`}
                                        onClick={() => setViewMode('list')} title="List view"
                                    >
                                        <List size={12} strokeWidth={2} />
                                    </button>
                                    <button
                                        className="gda-ico-btn"
                                        onClick={() => sendMessage('Show my recent files')}
                                        title="Refresh"
                                    >
                                        <RefreshCw size={12} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>

                            {/* List column headers */}
                            {viewMode === 'list' && filteredFiles.length > 0 && (
                                <div className="gda-list-hdr">
                                    <span className="gda-lhdr-name">Name</span>
                                    <span className="gda-lhdr-size">Size</span>
                                    <span className="gda-lhdr-date">Modified</span>
                                    <span className="gda-lhdr-more" />
                                </div>
                            )}

                            {/* File list / grid */}
                            <div className={`gda-exp-body ${viewMode}`}>
                                {filteredFiles.length === 0 ? (
                                    <div className="gda-empty">
                                        <div className="gda-empty-ico">
                                            <HardDrive size={22} strokeWidth={1.4} />
                                        </div>
                                        <p>No files here yet.</p>
                                        <button
                                            className="gda-empty-btn"
                                            onClick={() => sendMessage('Show my recent files')}
                                        >
                                            <RefreshCw size={11} strokeWidth={2} /> Load files
                                        </button>
                                    </div>
                                ) : viewMode === 'list' ? (
                                    filteredFiles.map(f => (
                                        <FileRow
                                            key={f.id}
                                            file={f}
                                            selected={selectedId === f.id}
                                            onSelect={setSelectedId}
                                            onQuickAction={(file) => setMenuFile(file)}
                                        />
                                    ))
                                ) : (
                                    <div className="gda-grid">
                                        {filteredFiles.map(f => (
                                            <FileGridCard
                                                key={f.id}
                                                file={f}
                                                selected={selectedId === f.id}
                                                onSelect={setSelectedId}
                                                onQuickAction={(file) => setMenuFile(file)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected file action strip */}
                            {selectedFile && !menuFile && (
                                <div className="gda-detail">
                                    <div className="gda-detail-top">
                                        {(() => {
                                            const { icon: Icon, color } = getMime(selectedFile.mimeType);
                                            return <Icon size={16} color={color} strokeWidth={1.8} />;
                                        })()}
                                        <span className="gda-detail-name">{selectedFile.name}</span>
                                        <button className="gda-ico-btn" onClick={() => setSelectedId(null)}>
                                            <X size={13} strokeWidth={2} />
                                        </button>
                                    </div>
                                    <div className="gda-detail-actions">
                                        {selectedFile.webViewLink && (
                                            <a href={selectedFile.webViewLink} target="_blank" rel="noopener noreferrer" className="gda-det-btn">
                                                <Eye size={11} strokeWidth={2} /> Open
                                            </a>
                                        )}
                                        <button className="gda-det-btn" onClick={() => sendMessage(`Summarize the file "${selectedFile.name}" with ID ${selectedFile.id}`)}>
                                            <Sparkles size={11} strokeWidth={2} /> Summarize
                                        </button>
                                        <button className="gda-det-btn" onClick={() => sendMessage(`Share "${selectedFile.name}" — ask me who to share it with`)}>
                                            <Share2 size={11} strokeWidth={2} /> Share
                                        </button>
                                        <button className="gda-det-btn danger" onClick={() => sendMessage(`Trash the file "${selectedFile.name}" with ID ${selectedFile.id}`)}>
                                            <Trash size={11} strokeWidth={2} /> Trash
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Context menu */}
                            {menuFile && (
                                <div ref={menuRef} className="gda-menu-wrap">
                                    <FileMenu
                                        file={menuFile}
                                        onAction={handleMenuAction}
                                        onClose={() => setMenuFile(null)}
                                    />
                                </div>
                            )}
                        </aside>
                    )}
                </div>
            </div>

            <ToastStack toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
        </div>
    );
}