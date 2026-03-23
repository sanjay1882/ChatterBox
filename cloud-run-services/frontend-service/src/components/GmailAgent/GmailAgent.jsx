import React, { useState, useRef, useEffect } from 'react';
import {
    Mail, Inbox, Send, FileText, Star,
    PanelRight, PanelLeftClose, PanelLeftOpen,
    Undo2, Redo2, X,
    PenLine, ArrowUp, Loader2, Layers,
    Search, Calendar, Sparkles, Mails,
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { gmailAgentStream } from '../../services/api';
import MessageBubble from '../Chat/MessageBubble';
import TreevitLoader from '../Chat/TreevitLoader';


/* ─────────────────────────────────────
   Constants
───────────────────────────────────── */
const WELCOME_MESSAGE = {
    role: 'ai',
    content: `Hello! I'm your **Gmail Assistant**\n\nI can help you:\n- **Draft** new emails based on your ideas\n- **Search** for specific conversations or attachments\n- **Summarize** long threads\n- **Manage** labels and clean up your inbox\n\nWhat would you like to do with your emails today?`,
};

const NAV_ITEMS = [
    { icon: Inbox,    label: 'Inbox',  count: 12 },
    { icon: Send,     label: 'Sent'              },
    { icon: FileText, label: 'Drafts', count: 3  },
    { icon: Star,     label: 'Starred'            },
];

const LABELS = [
    { color: '#4285f4', label: 'Work'     },
    { color: '#34a853', label: 'Personal' },
    { color: '#fbbc04', label: 'Finance'  },
];

const SUGGESTIONS = [
    { icon: PenLine,  label: 'Compose',   prompt: 'Draft a thank you email'    },
    { icon: Search,   label: 'Search',    prompt: 'Search my recent emails'     },
    { icon: Sparkles, label: 'Summarize', prompt: 'Summarize my unread emails'  },
    { icon: Calendar, label: 'Meetings',  prompt: 'Check for important meetings'},
];

/* ─────────────────────────────────────
   Component
───────────────────────────────────── */
export default function GmailAgent({ settings }) {
    const { user, token, googleConnected, googleAccessToken, getFreshToken } = useAuth();

    const [messages,     setMessages]     = useState([WELCOME_MESSAGE]);
    const [input,        setInput]        = useState('');
    const [isThinking,   setIsThinking]   = useState(false);
    const [sessionId,    setSessionId]    = useState(null);
    const [emails,       setEmails]       = useState([]);
    const [sidebarOpen,  setSidebarOpen]  = useState(false);
    const [canvasOpen,   setCanvasOpen]   = useState(false);
    const [activeNav,    setActiveNav]    = useState('Inbox');
    const [history,      setHistory]      = useState([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const msgsEndRef  = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    /* ── History ── */
    const saveToHistory = (newState) => {
        const next = history.slice(0, historyIndex + 1);
        next.push(newState);
        setHistory(next);
        setHistoryIndex(next.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const i = historyIndex - 1;
            setHistoryIndex(i);
            setEmails(history[i]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const i = historyIndex + 1;
            setHistoryIndex(i);
            setEmails(history[i]);
        }
    };

    /* ── Textarea auto-resize ── */
    const resizeTextarea = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    /* ── Send ── */
    const sendMessage = async (text) => {
        if (!googleConnected) {
            setMessages(prev => [...prev, {
                role: 'ai',
                content: "⚠️ **Please connect your Google account first** to access your emails. Click 'Connect Google' in the Apps menu."
            }]);
            return;
        }

        const msgText = (text || input).trim();
        if (!msgText || isThinking) return;

        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        setMessages(prev => [...prev, { role: 'user', content: msgText }]);
        setIsThinking(true);

        const aiMsgId = Date.now();
        setMessages(prev => [...prev, { role: 'ai', content: '', id: aiMsgId }]);

        let accumulated = '';
        try {
            const activeToken = await getFreshToken();
            await gmailAgentStream({
                message: msgText,
                emails,
                token: activeToken,
                email: user?.email,
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
                        setMessages(prev =>
                            prev.map(m => m.id === aiMsgId ? { ...m, content: data.fullMessage } : m)
                        );
                    }
                    if (data.actions?.length > 0) handleGmailActions(data.actions);
                },
            });
        } catch (err) {
            setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, content: `Error: ${err.message}` } : m)
            );
        } finally {
            setIsThinking(false);
        }
    };

    const handleGmailActions = (actions) => {
        setEmails(prev => {
            let next = [...prev];
            actions.forEach(action => {
                if (action.type === 'search' && Array.isArray(action.results) && action.results.length > 0) {
                    next = action.results.map(e => ({
                        id: e.id,
                        from: e.from || 'Unknown',
                        subject: e.subject || e.snippet || 'No Subject',
                        date: 'Recent',
                        snippet: e.snippet
                    }));
                }
            });
            saveToHistory(next);
            return next;
        });
    };

    const closeSidebarMobile = () => {
        if (window.innerWidth < 768) setSidebarOpen(false);
    };

    /* ── Render ── */
    return (
        <div className="ga-root">

            {/* ══════ Sidebar ══════ */}
            <aside className={`ga-sidebar ${sidebarOpen ? '' : 'closed'}`}>
                <div className="ga-sidebar-header">
                    <div className="ga-brand">
                        <div className="ga-brand-icon">
                            <Mail size={16} color="#fff" strokeWidth={2.2} />
                        </div>
                        Gmail AI
                    </div>
                    <button
                        className="ga-close-sidebar"
                        onClick={() => setSidebarOpen(false)}
                        title="Close sidebar"
                    >
                        <X size={16} strokeWidth={2} />
                    </button>
                </div>

                <div className="ga-sidebar-body">
                    <div className="ga-nav-section">
                        {NAV_ITEMS.map(({ icon: Icon, label, count }) => (
                            <div
                                key={label}
                                className={`ga-nav-item ${activeNav === label ? 'active' : ''}`}
                                onClick={() => { setActiveNav(label); closeSidebarMobile(); }}
                            >
                                <Icon size={16} strokeWidth={activeNav === label ? 2.2 : 1.75} />
                                <span>{label}</span>
                                {count && <span className="ga-nav-count">{count}</span>}
                            </div>
                        ))}
                    </div>

                    <div className="ga-divider" />

                    <div className="ga-nav-section">
                        <div className="ga-nav-label">Labels</div>
                        {LABELS.map(({ color, label }) => (
                            <div key={label} className="ga-nav-item">
                                <span className="ga-label-dot" style={{ background: color }} />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="ga-overlay" onClick={() => setSidebarOpen(false)} />
            )}

            {/* ══════ Main ══════ */}
            <div className="ga-main">

                {/* Topbar */}
                <header className="ga-topbar">
                    <div className="ga-topbar-left">
                        <button
                            className={`ga-icon-btn ${sidebarOpen ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(v => !v)}
                            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                        >
                            {sidebarOpen
                                ? <PanelLeftClose size={15} strokeWidth={1.9} />
                                : <PanelLeftOpen  size={15} strokeWidth={1.9} />
                            }
                        </button>
                        <span className="ga-topbar-title">{activeNav}</span>
                    </div>

                    <div className="ga-topbar-right">
                        <button
                            className="ga-icon-btn"
                            onClick={undo}
                            disabled={historyIndex === 0}
                            title="Undo"
                        >
                            <Undo2 size={15} strokeWidth={1.9} />
                        </button>
                        <button
                            className="ga-icon-btn"
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            title="Redo"
                        >
                            <Redo2 size={15} strokeWidth={1.9} />
                        </button>

                        <div className="ga-topbar-sep" />

                        <div className="ga-status-badge">
                            <div
                                className={`ga-status-dot ${googleConnected ? 'online' : ''}`}
                                style={{ background: googleConnected ? '#34a853' : '#ccc' }}
                            />
                            {googleConnected ? 'Connected' : 'Disconnected'}
                        </div>

                        <div className="ga-topbar-sep" />

                        <button
                            className={`ga-canvas-toggle-btn ${canvasOpen ? 'open' : ''}`}
                            onClick={() => setCanvasOpen(v => !v)}
                        >
                            <PanelRight size={14} strokeWidth={2} />
                            <span>{canvasOpen ? 'Close Canvas' : 'Open Canvas'}</span>
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="ga-messages">
                    {messages.map((msg, i) => (
                        <MessageBubble
                            key={i}
                            msg={msg}
                            userPhoto={user?.photoURL}
                            isStreaming={isThinking && i === messages.length - 1}
                        />
                    ))}

                    {isThinking && !messages[messages.length - 1]?.content && (
                        <div className="ga-typing-wrap">
                            <div className="ga-typing-avatar">
                                <Mail size={13} strokeWidth={2.2} color="#fff" />
                            </div>
                            <div className="ga-typing-bubble" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
                                <TreevitLoader size={20} className="cursor-logo" />
                            </div>
                        </div>
                    )}

                    <div ref={msgsEndRef} />
                </div>

                {/* Input */}
                <div className="ga-input-area">
                    <div className="ga-suggestions">
                        {SUGGESTIONS.map(({ icon: Icon, label, prompt }) => (
                            <button
                                key={label}
                                className="ga-chip"
                                onClick={() => sendMessage(prompt)}
                            >
                                <Icon size={13} strokeWidth={2} />
                                <span className="chip-label">{label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="ga-input-box">
                        <span className="ga-input-icon">
                            <PenLine size={16} strokeWidth={1.8} />
                        </span>
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={e => { setInput(e.target.value); resizeTextarea(); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder="Draft, search, or ask anything about your emails…"
                        />
                        <button
                            className="ga-send-btn"
                            onClick={() => sendMessage()}
                            disabled={isThinking || !input.trim()}
                            title="Send"
                        >
                            {isThinking
                                ? <span className="ga-spin"><Loader2 size={16} strokeWidth={2} /></span>
                                : <ArrowUp size={16} strokeWidth={2.2} />
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* ══════ Canvas Panel ══════ */}
            <aside className={`ga-canvas ${canvasOpen ? 'open' : ''}`}>
                <div className="ga-canvas-header">
                    <div className="ga-canvas-header-left">
                        <Layers size={15} strokeWidth={1.9} />
                        <h4>Email Canvas</h4>
                        {emails.length > 0 && (
                            <span className="ga-canvas-count">{emails.length}</span>
                        )}
                    </div>
                    <button
                        className="ga-icon-btn"
                        onClick={() => setCanvasOpen(false)}
                        title="Close canvas"
                    >
                        <X size={15} strokeWidth={2} />
                    </button>
                </div>

                <div className="ga-canvas-body">
                    {emails.length > 0 ? (
                        emails.map(email => (
                            <div key={email.id} className="ga-email-card">
                                <div className="ga-email-card-top">
                                    <span className="ga-email-from">{email.from}</span>
                                    <span className="ga-email-date">{email.date}</span>
                                </div>
                                <div className="ga-email-subject">{email.subject}</div>
                            </div>
                        ))
                    ) : (
                        <div className="ga-canvas-empty">
                            <div className="ga-canvas-empty-icon">
                                <Mails size={22} strokeWidth={1.5} />
                            </div>
                            <p>Ask me to search or summarize emails — results will appear here.</p>
                        </div>
                    )}
                </div>
            </aside>

        </div>
    );
}