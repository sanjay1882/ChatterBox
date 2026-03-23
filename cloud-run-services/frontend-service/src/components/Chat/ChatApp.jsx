import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCredits } from '../../contexts/CreditsContext';
import { streamChat, getSessions, getSession, deleteSession, generateImage, getGallery, getUserPreferences, saveUserPreferences, updateTheme as apiUpdateTheme, updateVoice as apiUpdateVoice, updateModel as apiUpdateModel } from '../../services/api';
import { renderMarkdown, highlightAllCodeBlocks } from '../../utils/markdown';
import { formatStreamedText } from '../../utils/formatStreamedText';

import Sidebar from '../Layout/Sidebar';
import './GeminiInput.css';
import { AGENTS } from '../../config/agents';
import showToast from '../../utils/toast';
import '../../utils/windowHandlers';
import TreevitLoader from './TreevitLoader';
import Canvas from './Canvas/Canvas';
import PrivacyPolicy from '../Legal/PrivacyPolicy';
import TermsOfService from '../Legal/TermsOfService';

const extractFrontendFromText = (text) => {
    const blocks = [];
    const regex = /```(html|css|javascript|js|jsx|react|typescript|ts)\s*([\s\S]*?)```/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        blocks.push({
            language: match[1].toLowerCase(),
            code: match[2].trim()
        });
    }
    
    const isFrontend = blocks.some(b => ['html', 'css', 'jsx', 'react'].includes(b.language));
    if (!isFrontend) return null;

    const htmlBlock = blocks.find(b => b.language === 'html');
    const cssBlock = blocks.find(b => b.language === 'css');
    
    let combinedHtml = htmlBlock ? htmlBlock.code : '';
    if (cssBlock) {
        combinedHtml = `<style>${cssBlock.code}</style>\n${combinedHtml}`;
    }

    const fileCounts = {};
    const files = blocks.map(b => {
        const baseName = b.language === 'html' ? 'index' : 
                         b.language === 'css' ? 'style' : 'script';
        const ext = b.language === 'html' ? 'html' : 
                    b.language === 'css' ? 'css' : 'js';
        
        fileCounts[ext] = (fileCounts[ext] || 0) + 1;
        const finalName = fileCounts[ext] === 1 ? `${baseName}.${ext}` : `${baseName}${fileCounts[ext]}.${ext}`;
        
        return {
            name: finalName,
            code: b.code
        };
    });

    return {
        type: 'frontend',
        title: 'Frontend Workspace',
        content: {
            html: combinedHtml || (blocks.length > 0 ? blocks[0].code : ''),
            files
        }
    };
};

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:3000');



const MarkdownContent = ({ html, className, style }) => {
    const containerRef = useRef(null);
    useEffect(() => {
        if (containerRef.current) {
            highlightAllCodeBlocks(containerRef.current);
        }
    }, [html]);
    return (
        <span 
            ref={containerRef} 
            className={className} 
            style={style} 
            dangerouslySetInnerHTML={{ __html: html }} 
        />
    );
};

// AnimatedMessage no longer animates character-by-character â€“ the
// streaming logic in handleSend now updates the message.html field using the
// same algorithm used by the vanilla frontend, so here we merely render the
// already-formatted HTML (or fall back to simple markdown). Keeping the
// component simplifies the JSX below.
const AnimatedMessage = ({ html, message, isLoading }) => {
    // if html is supplied we trust that it already contains the proper
    // formatting (tables, think blocks, etc).  Otherwise fall back to
    // renderMarkdown for backwards compatibility.
    const inner = useMemo(() => html || renderMarkdown(message || ''), [html, message]);

    return (
        <div className="animated-message-container" style={{ display: 'inline' }}>
            <MarkdownContent html={inner} style={{ display: 'inline' }} />
            {isLoading && (
                <div style={{ display: 'inline-block', verticalAlign: 'middle', lineHeight: '1' }}>
                    <TreevitLoader size={20} className="cursor-logo" />
                </div>
            )}
        </div>
    );
};

// same modifier used by original chat so animation speed matches exactly
const STREAMING_SPEED_MODIFIER = 500;

// â”€â”€ Typewriter animation for header text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TypewriterText = ({ text, speed = 42 }) => {
    const [displayed, setDisplayed] = useState('');
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        setDisplayed('');
        setShowCursor(true);
        let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) {
                setDisplayed(text.slice(0, i + 1));
                i++;
            } else {
                clearInterval(interval);
                // blink cursor for a moment then hide it
                setTimeout(() => setShowCursor(false), 1200);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span className="typewriter-header">
            {displayed}
            {showCursor && <span className="typewriter-cursor" />}
        </span>
    );
};

const SUGGESTIONS = [
    { id: 'sugg', icon: 'bx-code-block', title: 'Debug My Code', text: "Here's a bug I'm stuck on â€” can you find the issue and explain what went wrong?", accent: 'linear-gradient(135deg, #6366f1, #818cf8)' },
    { id: 'sugg2', icon: 'bx-pen', title: 'Polish My Writing', text: 'Rewrite this paragraph to sound more professional and concise, while keeping the tone friendly.', accent: 'linear-gradient(135deg, #10b981, #34d399)' },
    { id: 'sugg3', icon: 'bx-bar-chart-alt-2', title: 'Explain This Data', text: 'Analyze these numbers and tell me the key trends, outliers, and what actions I should take.', accent: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    { id: 'sugg4', icon: 'bx-brain', title: 'Brainstorm Ideas', text: 'Give me 10 creative, unconventional ideas for my project â€” think outside the box.', accent: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    { id: 'sugg5', icon: 'bx-book-open', title: 'Summarize This', text: 'Summarize this article or document into 5 bullet points I can read in 30 seconds.', accent: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
    { id: 'sugg6', icon: 'bx-message-square-dots', title: 'Write My Email', text: 'Draft a professional follow-up email after a meeting â€” firm but polite, keep it short.', accent: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
];


const GREETINGS = [
    'Hello, How Can I Help?',
    'How can I assist you today?',
    'What brings you here?',
    'Need a hand with something?',
    'What\'s on your mind?',
    'How can I support you today?',
];

const MODELS = [
    { value: 'auto', label: 'Auto (Recommended)', gemini: 'auto', title: 'Auto Model Selection' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', gemini: 'gemini-2.0-flash', title: 'Google Gemini 2.0 Flash' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', gemini: 'gemini-2.5-flash', title: 'Google Gemini 2.5 Flash' },
    { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', gemini: 'moonshotai/kimi-k2-instruct-0905', title: 'Kimi K2 / Claude Sonnet 4' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', gemini: 'llama-3.3-70b-versatile', title: 'Meta Llama 3.3 70B' },
    { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B', gemini: 'qwen3-32b', title: 'Alibaba Qwen 3 32B' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', gemini: 'openai/gpt-oss-120b', title: 'OpenAI GPT-OSS 120B' },
];

const LANGUAGES = [
    { code: 'hi', name: 'Hindi', flag: 'ðŸ‡®ðŸ‡³' },
    { code: 'ta', name: 'Tamil', flag: 'ðŸ‡®ðŸ‡³' },
    { code: 'te', name: 'Telugu', flag: 'ðŸ‡®ðŸ‡³' },
    { code: 'fr', name: 'French', flag: 'ðŸ‡«ðŸ‡·' },
    { code: 'es', name: 'Spanish', flag: 'ðŸ‡ªðŸ‡¸' },
    { code: 'de', name: 'German', flag: 'ðŸ‡©ðŸ‡ª' },
    { code: 'ja', name: 'Japanese', flag: 'ðŸ‡¯ðŸ‡µ' },
    { code: 'ko', name: 'Korean', flag: 'ðŸ‡°ðŸ‡·' },
    { code: 'zh', name: 'Chinese', flag: 'ðŸ‡¨ðŸ‡³' },
    { code: 'ru', name: 'Russian', flag: 'ðŸ‡·ðŸ‡º' },
    { code: 'ar', name: 'Arabic', flag: 'ðŸ‡¸ðŸ‡¦' },
    { code: 'pt', name: 'Portuguese', flag: 'ðŸ‡µðŸ‡¹' }
];

const escapeHtml = (value = '') => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatUserTextHtml = (value = '') => escapeHtml(value).replace(/\n/g, '<br />');

const getEditableUserText = (value = '') => {
    const [mainText] = value.split('[Pasted Context]:\n');
    return mainText.trimEnd();
};

const buildUserMessageHtml = ({ text = '', pastedContent = '', selectedFile = null }) => {
    const sections = [];

    if (selectedFile) {
        if (selectedFile.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(selectedFile);
            sections.push(`
                <div class="user-attached-image">
                    <div class="user-attached-image-card">
                        <img src="${objectUrl}" alt="${escapeHtml(selectedFile.name || 'Uploaded image')}" />
                    </div>
                </div>
            `);
        } else {
            sections.push(`
                <div class="user-attached-file">
                    <i class='bx bx-file'></i>
                    <div class="user-attached-file-meta">
                        <span class="user-attached-file-label">Attached file</span>
                        <strong>${escapeHtml(selectedFile.name)}</strong>
                    </div>
                </div>
            `);
        }
    }

    if (pastedContent) {
        sections.push(`
            <div class="pasted-snippet-preview">
                <div class="pasted-snippet-label">Attached Snippet</div>
                <div class="pasted-snippet-body">${formatUserTextHtml(pastedContent)}</div>
            </div>
        `);
    }

    if (text) {
        sections.push(`<div class="user-message-text">${formatUserTextHtml(text)}</div>`);
    }

    return `<div class="user-message-stack">${sections.join('')}</div>`;
};

const CustomSelect = ({ id, value, onChange, options, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className={`custom-select-wrapper ${isOpen ? 'open' : ''}`} id={`${id}-wrapper`} onClick={() => setIsOpen(!isOpen)} onBlur={() => setIsOpen(false)} tabIndex={0}>
            <div className={`custom-select-trigger ${isOpen ? 'open' : ''}`} id={`${id}-trigger`}>
                <span id={`${id}-display`}>{selectedLabel}</span>
                <i className='bx bx-chevron-down'></i>
            </div>
            {isOpen && (
                <div className="custom-options" id={`${id}-options`} style={{ display: 'block' }}>
                    {options.map(o => (
                        <div
                            key={o.value}
                            className={`custom-option ${value === o.value ? 'selected' : ''}`}
                            data-value={o.value}
                            onMouseDown={() => { onChange(o.value); setIsOpen(false); }}
                        >
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function ChatApp({ initialAppsOpen = false, initialSettingsOpen = false }) {
    const { sessionId, agentId, shareId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [showBrowserPanel, setShowBrowserPanel] = useState(true);
    const [browserWidth, setBrowserWidth] = useState(Math.min(420, window.innerWidth * 0.35));
    const [isResizing, setIsResizing] = useState(false);

    // Resize logic for browser panel
    const startResizing = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((e) => {
        if (isResizing) {
            const newWidth = window.innerWidth - e.clientX;
            // Limit width between 300px and 70% of viewport
            if (newWidth > 300 && newWidth < window.innerWidth * 0.7) {
                setBrowserWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

    const toggleBrowserPanel = () => {
        setShowBrowserPanel(prev => !prev);
    };


    const { user, token, isGuest, logout, googleConnected, connectGoogle, unlinkGoogle, getFreshToken } = useAuth();
    const { checkImageGeneration, consumeImageCredit, isPro, credits } = useCredits();

    const isReadOnly = !!shareId;
    const sharedSessionId = shareId;

    // ── Sidebar & Layout ──────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [sidebarWidth, setSidebarWidth] = useState(230);
    const isMobile = window.innerWidth <= 768;

    const handleSidebarResize = (newWidth) => {
        if (newWidth >= 160 && newWidth <= 480) {
            setSidebarWidth(newWidth);
        }
    };

    // ── Sessions ────────────────────────────────────────────────
    const [sessions, setSessions] = useState([]);
    const [sessHasMore, setSessHasMore] = useState(false);
    const [sessPage, setSessPage] = useState(1);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Messages ────────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showHome, setShowHome] = useState(true);
    const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    const [sourceLinks, setSourceLinks] = useState([]);
    const [browserPreview, setBrowserPreview] = useState(null);
    const [showEmbeddedPreview, setShowEmbeddedPreview] = useState(false);

    // ── Input state ─────────────────────────────────────────────
    const [appMode, setAppMode] = useState('chat');
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [pastedContent, setPastedContent] = useState('');
    const [webSearch, setWebSearch] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [showModelOptions, setShowModelOptions] = useState(false);
    const [isTemporary, setIsTemporary] = useState(false);
    const [isImageGen, setIsImageGen] = useState(false);
    const [excelAssistEnabled, setExcelAssistEnabled] = useState(true);

    // ── Settings modal ──────────────────────────────────────────
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState('general');

    // ── Apps modal ──────────────────────────────────────────────
    const [appsOpen, setAppsOpen] = useState(false);
    const [appsSelected, setAppsSelected] = useState('excel'); 

    // ── Modals ──────────────────────────────────────────────────
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [imageModal, setImageModal] = useState({ open: false, src: '', caption: '' });
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]); 

    // ── Speech Recognition ──────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [availableVoices, setAvailableVoices] = useState([]);
    const [settings, setSettings] = useState({
        userGender: '', userAge: '', userLanguage: '', userCulture: '',
        userDefaultModel: 'gemini-2.0-flash', userWritingStyle: '', userCreativity: '',
        userInterests: '', userCustomRules: '', userVoice: '',
        heatwaveMode: false
    });

    // ── Message Actions State ──────────────────────────
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editText, setEditText] = useState('');
    const [translationMenu, setTranslationMenu] = useState(null); 
    const [translations, setTranslations] = useState({}); 
    const [speakingMessageId, setSpeakingMessageId] = useState(null);
    const [copiedMessageId, setCopiedMessageId] = useState(null);

    // ── Theme state ─────────────────────────────────────────────
    const [theme, setTheme] = useState(() => localStorage.getItem('app-theme-style') || 'sarvam');
    const [mode, setMode] = useState(() => localStorage.getItem('app-theme-mode') || 'dark');
    const [tempSettings, setTempSettings] = useState(null);
    const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // ── Canvas state ──
    const [isCanvasOpen, setIsCanvasOpen] = useState(false);
    const [legalOpen, setLegalOpen] = useState(false);
    const [legalTab, setLegalTab] = useState('privacy'); // privacy | terms
    const [canvasData, setCanvasData] = useState({
        type: 'code',
        title: 'Canvas Workspace',
        content: {
            language: 'javascript',
            code: '// Welcome to the Treevit Canvas\n\nconst workspace = {\n    purpose: "Extended AI outputs",\n    features: [\n        "Code editing",\n        "HTML previews",\n        "Interactive quizzes",\n        "Rich documentation"\n    ],\n    responsive: true,\n    active: true\n};'
        }
    });

    const startNewChat = useCallback(() => {
        setAppMode('chat');
        setCurrentSessionId(null);
        setMessages([]);
        setShowHome(true);
        setInputText('');
        setSelectedFile(null);
        setSourceLinks([]);
        setBrowserPreview(null);
        setShowEmbeddedPreview(false);
        if (openPreviewSetRef.current) openPreviewSetRef.current = false;
        setSidebarOpen(false);
    }, []);

    useEffect(() => {
        if (currentSessionId && sessions.length > 0) {
            const currentSession = sessions.find(s => s._id === currentSessionId);
            if (currentSession && currentSession.title && currentSession.title !== 'New Chat') {
                document.title = currentSession.title;
            } else {
                document.title = 'Treevit';
            }
        } else {
            document.title = 'Treevit';
        }
    }, [currentSessionId, sessions]);

    useEffect(() => {
        if (shareId) {
            setCurrentSessionId(shareId);
            setAppMode('chat');
            setShowHome(false);
        } else if (sessionId && !agentId) {
            setCurrentSessionId(sessionId);
            setAppMode('chat');
            setShowHome(false);
        } else if (agentId) {
            setAppMode(agentId);
            if (sessionId) setCurrentSessionId(sessionId);
            else setShowHome(false);
        } else if (location.pathname === '/' || location.pathname === '/chat') {
            startNewChat();
        }
    }, [sessionId, agentId, shareId, location.pathname, startNewChat]);

    useEffect(() => {
        if (initialAppsOpen) setAppsOpen(true);
        if (initialSettingsOpen) {
            setSettingsOpen(true);
            setTempSettings({
                ...settings,
                theme: theme,
                mode: mode
            });
        }
    }, [initialAppsOpen, initialSettingsOpen, settings, theme, mode]);

    useEffect(() => {
        // dark = default (no class), light = data-theme="light"
        if (mode === 'light') {
            document.body.setAttribute('data-theme', 'light');
        } else {
            document.body.removeAttribute('data-theme');
        }

        // Toggle the public stylesheet manually for the two themes
        const link = document.getElementById('sarvam-css-sheet');
        if (link) {
            link.disabled = (theme !== 'sarvam');
        }
    }, [theme, mode]);



    // â”€â”€ Load Voices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            setAvailableVoices(voices.map(v => ({ value: v.name, label: `${v.name} (${v.lang})` })));
        };
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);


    const toggleListening = () => {
        if (isListening) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
        } else {
            const SpeechReco = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechReco) return alert('Speech recognition not supported in your browser.');
            const rec = new SpeechReco();
            rec.continuous = true;
            rec.interimResults = true;
            rec.onresult = (e) => {
                let final = '';
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                    else interim += e.results[i][0].transcript;
                }
                if (final) setInputText(p => p + ' ' + final);
                setLiveTranscript(interim || final);
            };
            rec.onerror = (e) => {
                console.error('Speech recognition error', e.error);
                setIsListening(false);
            };
            rec.onend = () => setIsListening(false);
            rec.start();
            recognitionRef.current = rec;
            setIsListening(true);
            setLiveTranscript('');
        }
    };


    // â”€â”€ Global Handlers for Code Blocks & Image Download â”€â”€â”€â”€â”€


    // load stored preferences once on mount or when user changes
    useEffect(() => {
        const loadPreferences = async () => {
            // Priority 1: Server-side preferences
            if (user && user.email) {
                try {
                    const activeToken = await getFreshToken();
                    const serverPrefs = await getUserPreferences(user.email, activeToken);
                    if (serverPrefs) {
                        const mapped = {
                            userGender: serverPrefs.gender || '',
                            userAge: serverPrefs.ageGroup || '',
                            userLanguage: serverPrefs.language || '',
                            userCulture: serverPrefs.culture || '',
                            userDefaultModel: serverPrefs.defaultModel || 'gemini-2.5-flash',
                            userWritingStyle: serverPrefs.writingStyle || '',
                            userCreativity: serverPrefs.creativityLevel || '',
                            userInterests: serverPrefs.interests || '',
                            userCustomRules: serverPrefs.customRules || '',
                            userVoice: serverPrefs.voice || ''
                        };
                        setSettings(mapped);
                        if (mapped.userDefaultModel && MODELS.find(m => m.value === mapped.userDefaultModel)) {
                            setSelectedModel(mapped.userDefaultModel);
                        }
                        return; // Done
                    }
                } catch (e) { console.error("Failed to fetch preferences from server", e); }
            }

            // Priority 2: Local storage (fallback or guests)
            const saved = localStorage.getItem('chatSettings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setSettings(parsed);
                    if (parsed.userDefaultModel && MODELS.find(m => m.value === parsed.userDefaultModel)) {
                        setSelectedModel(parsed.userDefaultModel);
                    }
                } catch { }
            }
        };

        loadPreferences();
    }, [user?.email, getFreshToken]);

    const persistSettings = async (updatedSettings) => {
        const toSave = updatedSettings || settings;
        // Save to localStorage
        localStorage.setItem('chatSettings', JSON.stringify(toSave));
        
        // Save theme/mode
        if (toSave.theme) {
            setTheme(toSave.theme);
            localStorage.setItem('app-theme-style', toSave.theme);
        }
        if (toSave.mode) {
            setMode(toSave.mode);
            localStorage.setItem('app-theme-mode', toSave.mode);
        }

        // Save to Server if logged in
        if (user && user.email) {
            try {
                const mapped = {
                    gender: toSave.userGender,
                    ageGroup: toSave.userAge,
                    language: toSave.userLanguage,
                    culture: toSave.userCulture,
                    defaultModel: toSave.userDefaultModel,
                    writingStyle: toSave.userWritingStyle,
                    creativityLevel: toSave.userCreativity,
                    interests: toSave.userInterests,
                    customRules: toSave.userCustomRules,
                    voice: toSave.userVoice,
                    heatwaveMode: toSave.heatwaveMode
                };
                const activeToken = await getFreshToken();
                await saveUserPreferences(user.email, activeToken, mapped);
            } catch (e) { console.error("Failed to save preferences to server", e); }
        }
    };

    const validateSettings = (data) => {
        if (!data.userLanguage?.trim()) return "Mother Tongue / Primary Language cannot be empty.";
        if (!data.userCulture?.trim()) return "Cultural Background cannot be empty.";
        return null;
    };

    const handleGlobalSave = async () => {
        const error = validateSettings(tempSettings);
        if (error) {
            showToast(error, 'error');
            return;
        }

        setIsSaving(true);
        try {
            await persistSettings(tempSettings);
            setSettings(tempSettings);
            showToast('Preferences saved successfully!');
            setSettingsOpen(false);
            setTempSettings(null);
            navigate('/chat');
        } catch (err) {
            showToast('Failed to save preferences', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const isSettingsDirty = () => {
        if (!tempSettings) return false;
        return (
            tempSettings.userGender !== settings.userGender ||
            tempSettings.userAge !== settings.userAge ||
            tempSettings.userLanguage !== settings.userLanguage ||
            tempSettings.userCulture !== settings.userCulture ||
            tempSettings.userDefaultModel !== settings.userDefaultModel ||
            tempSettings.userWritingStyle !== settings.userWritingStyle ||
            tempSettings.userCreativity !== settings.userCreativity ||
            tempSettings.userInterests !== settings.userInterests ||
            tempSettings.userCustomRules !== settings.userCustomRules ||
            tempSettings.userVoice !== settings.userVoice ||
            tempSettings.heatwaveMode !== settings.heatwaveMode ||
            tempSettings.theme !== theme ||
            tempSettings.mode !== mode
        );
    };

    const requestCloseSettings = () => {
        if (isSettingsDirty()) {
            setShowUnsavedPrompt(true);
        } else {
            setSettingsOpen(false);
            setTempSettings(null);
            navigate('/chat');
        }
    };

    const handleSaveGeneral = async (e) => {
        if (e) e.preventDefault();
        await handleGlobalSave();
    };

    const handleSaveAiBehavior = async (e) => {
        if (e) e.preventDefault();
        await handleGlobalSave();
    };

    // reset selected agent when closing apps panel
    useEffect(() => {

        if (!appsOpen) {
            setAppsSelected('excel');
        }
    }, [appsOpen]);

    // prevent body scroll when any modal is open
    useEffect(() => {
        const isAnyModalOpen = settingsOpen || appsOpen || deleteModal.open;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = '15px'; // compensate for scrollbar width
            document.body.classList.add('modal-open');
        } else {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0';
            document.body.classList.remove('modal-open');
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.body.style.paddingRight = '0';
            document.body.classList.remove('modal-open');
        };
    }, [settingsOpen, appsOpen, deleteModal.open]);

    // â”€â”€ Refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const recognitionRef = useRef(null);
    const chatboxRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const pastedTextRef = useRef(null);
    const ignoreNextSessionLoadRef = useRef(false);
    const openPreviewSetRef = useRef(false);

    // â”€â”€ Scroll lock ref: true when user has scrolled up â”€â”€â”€â”€â”€â”€â”€â”€
    // Using a ref (not state) so it updates instantly without re-render
    const userScrolledUpRef = useRef(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Attach scroll listener once the chatbox mounts
    useEffect(() => {
        const box = chatboxRef.current;
        if (!box) return;
        const onScroll = () => {
            const distFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
            const scrolledUp = distFromBottom > 80;
            userScrolledUpRef.current = scrolledUp;
            setShowScrollBtn(scrolledUp);
        };
        box.addEventListener('scroll', onScroll, { passive: true });
        return () => box.removeEventListener('scroll', onScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount once â€” chatboxRef is stable

    // â”€â”€ Auto resize textarea â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }, [inputText]);

    // â”€â”€ After messages update: only run syntax highlight, NO auto-scroll
    // Scrolling is handled directly in the streaming RAF loop with userScrolledUpRef guard

    // â”€â”€ Load gallery images from DB on mount â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useEffect(() => {
        const loadGallery = async () => {
            if (!user || isGuest) return;
            try {
                const activeToken = await getFreshToken();
                const data = await getGallery(user.email, activeToken);
                if (data?.images?.length) {
                    setGalleryImages(
                        data.images.map(img => ({
                            src: `data:image/png;base64,${img.imageBase64}`,
                            prompt: img.prompt,
                            ts: new Date(img.createdAt).getTime()
                        }))
                    );
                }
            } catch (e) {
                console.error("Gallery load error:", e);
            }
        };
        loadGallery();
    }, [user?.email, getFreshToken, isGuest]);

    // â”€â”€ Load sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const loadSessions = useCallback(async (page = 1, append = false) => {
        if (!user || isGuest || isReadOnly) return;
        setSessionsLoading(true);
        try {
            const activeToken = await getFreshToken();
            const data = await getSessions(user.email, activeToken, page);
            if (append) setSessions(p => [...p, ...(data.sessions || [])]);
            else setSessions(data.sessions || []);
            setSessHasMore(data.hasNextPage || false);
            setSessPage(page);
        } catch (e) { 
            console.error("Load sessions error:", e); 
        }
        finally { setSessionsLoading(false); }
    }, [user?.email, isGuest, isReadOnly, getFreshToken]);

    useEffect(() => { loadSessions(1); }, [loadSessions]);

    // â”€â”€ Load session messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const loadSessionMessages = useCallback(async (id) => {
        setIsLoading(true);
        setMessages([]);
        setShowHome(false);
        try {
            const activeToken = await getFreshToken();
            let data;
            if (isReadOnly) {
                data = await import('../../services/api').then(m => m.getPublicSession(id));
            } else {
                data = await getSession(user.email, id, activeToken);
            }
            if (data?.messages) {
                setMessages(data.messages.map((m, idx) => {
                    let rawText = '';
                    let html = '';
                    const role = m.role === 'model' ? 'incoming' : 'outgoing';

                    if (role === 'incoming' && m.parts?.[0]?.inlineData) {
                        const base64 = m.parts[0].inlineData.data;
                        const mime = m.parts[0].inlineData.mimeType || 'image/png';
                        const imgSrc = `data:${mime};base64,${base64}`;

                        const prevMsg = data.messages[idx - 1];
                        let promptText = prevMsg?.parts?.[0]?.text || 'Generated Image';
                        if (promptText.startsWith('Generate image: ')) {
                            promptText = promptText.substring(16);
                        }
                        const shortPrompt = promptText.length > 80 ? promptText.slice(0, 80) + '\u2026' : promptText;

                        html = `<div class="generated-image-card"><div class="gen-image-wrap"><img class="generated-image" src="${imgSrc}" alt="${promptText.replace(/"/g, '&quot;')}" onclick="window.previewGeneratedImage(this)" title="Click to preview full size" /><div class="gen-image-overlay"><button class="gen-img-btn gen-preview-btn" onclick="window.previewGeneratedImage(this.closest('.generated-image-card').querySelector('.generated-image'))"><i class="bx bx-fullscreen"></i> Preview</button><button class="gen-img-btn gen-download-btn" onclick="window.downloadGeneratedImage(this)"><i class="bx bx-download"></i> Download</button></div></div><p class="gen-image-caption"><i class="bx bx-image-alt"></i> Here's your image for <em>"${shortPrompt}"</em> â€” click to preview or download above.</p></div>`;
                        rawText = promptText;
                    } else {
                        rawText = m.parts?.[0]?.text || '';
                        if (role === 'outgoing') {
                            if (rawText.includes('[Pasted Context]:')) {
                                const parts = rawText.split('[Pasted Context]:\n');
                                const mainText = parts[0].trim();
                                const pastedText = parts[1] ? parts[1].trim() : '';

                                html = mainText;
                                if (pastedText) {
                                    html += (html ? "<br/><br/>" : "") + `<div class="pasted-snippet-preview" style="background: rgba(255,255,255,0.05); border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 4px; font-size: 0.9em; overflow-x: auto;"><div style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-bottom: 4px; text-transform: uppercase;">Attached Snippet</div>${pastedText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
                                }
                            } else {
                                html = rawText;
                            }
                        } else {
                            html = formatStreamedText(rawText);
                        }
                    }

                    return {
                        id: m._id,
                        role,
                        content: (role === 'outgoing' && html !== rawText) ? html : rawText,
                        rawContent: rawText,
                        editableText: role === 'outgoing' ? getEditableUserText(rawText) : rawText,
                        html,
                        isHtml: role === 'outgoing' && html !== rawText,
                        loading: false
                    };
                }));
            }
        } catch (e) { console.error(e); }
        finally { 
            setIsLoading(false); 
            setTimeout(() => {
                if (chatboxRef.current) {
                    chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [user?.email, isReadOnly, getFreshToken]);

    useEffect(() => {
        if (currentSessionId) {
            if (ignoreNextSessionLoadRef.current) {
                ignoreNextSessionLoadRef.current = false;
            } else {
                loadSessionMessages(currentSessionId);
            }
        }
        else { 
            // If we are in a new chat (no currentSessionId), 
            // only show home if there are no messages yet.
            // This prevents the screen from resetting when the first message is sent.
            setMessages(prev => {
                if (prev.length === 0) {
                    setShowHome(true);
                    return [];
                }
                return prev;
            });
        }
    }, [currentSessionId, loadSessionMessages]);

    // â”€â”€ Send message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleSend = useCallback(async (overrideText, options = {}) => {
        const text = overrideText ?? inputText.trim();
        const { reuseMessageId = null } = options;
        if (!text && !selectedFile && !pastedContent) return;
        if (isLoading) return;

        // â”€â”€ Feature gate: image generation credits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (isImageGen && !checkImageGeneration()) {
            // checkImageGeneration() opens the upgrade modal automatically
            return;
        }

        setShowHome(false);
        setInputText('');
        setSelectedFile(null);
        setPastedContent('');
        setShowActionsMenu(false);
        setSourceLinks([]);
        setBrowserPreview(null);
        setShowEmbeddedPreview(false);
        openPreviewSetRef.current = false;
        // Re-engage auto-scroll for the new response
        userScrolledUpRef.current = false;
        setShowScrollBtn(false);

        const userMsgId = reuseMessageId || ('u-' + Date.now());
        const aiMsgId = 'a-' + Date.now();

        let finalMessageContent = text;
        if (pastedContent) {
            finalMessageContent += (finalMessageContent ? "\n\n" : "") + `[Pasted Context]:\n${pastedContent}`;
        }
        let msgDisplayHtml = text;
        let hasHtml = false;

        if (pastedContent || selectedFile) {
            msgDisplayHtml = buildUserMessageHtml({ text, pastedContent, selectedFile });
            hasHtml = true;
        }

        const userMsgObj = hasHtml ? { id: userMsgId, role: 'outgoing', content: msgDisplayHtml, isHtml: true, rawContent: finalMessageContent, editableText: text } : { id: userMsgId, role: 'outgoing', content: text, rawContent: finalMessageContent, editableText: text };

        // store both raw text and html for the AI message; html will be built
        // progressively by the formatter so the UI can render tables/code/think
        // blocks correctly while streaming.
        if (reuseMessageId) {
            setMessages(p => [
                ...p.map(m => m.id === reuseMessageId ? { ...m, ...userMsgObj } : m),
                { id: aiMsgId, role: 'incoming', content: '', html: '', loading: true, imageGen: isImageGen }
            ]);
        } else {
            setMessages(p => [...p, userMsgObj, { id: aiMsgId, role: 'incoming', content: '', html: '', loading: true, imageGen: isImageGen }]);
        }

        // Auto-scroll to bottom immediately so the user's message is visible
        setTimeout(() => {
            if (chatboxRef.current) {
                chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
            }
        }, 60);

        setIsLoading(true);

        const activeToken = await getFreshToken();

        // If user wants to generate image, bypass streamChat and hit the generate-image endpoint natively
        if (isImageGen) {
            setIsImageGen(false);
            try {
                const data = await generateImage(
                    text,
                    user?.email || 'guest@example.com',
                    currentSessionId,
                    isGuest ? 'guest' : activeToken
                );

                let htmlImg = `<div class="img-gen-error"><i class="bx bx-error-circle"></i><span>Image generation failed. Please try again.</span></div>`;
                if (data && data.imageBase64) {
                    const shortPrompt = text.length > 80 ? text.slice(0, 80) + '\u2026' : text;
                    const imgSrc = `data:image/png;base64,${data.imageBase64}`;
                    setGalleryImages(prev => [...prev, { src: imgSrc, prompt: text, ts: Date.now() }]);
                    consumeImageCredit(); // decrement free credit (no-op for Pro)
                    htmlImg = `<div class="generated-image-card"><div class="gen-image-wrap"><img class="generated-image" src="${imgSrc}" alt="${text.replace(/"/g, '&quot;')}" onclick="window.previewGeneratedImage(this)" title="Click to preview full size" /><div class="gen-image-overlay"><button class="gen-img-btn gen-preview-btn" onclick="window.previewGeneratedImage(this.closest('.generated-image-card').querySelector('.generated-image'))"><i class="bx bx-fullscreen"></i> Preview</button><button class="gen-img-btn gen-download-btn" onclick="window.downloadGeneratedImage(this)"><i class="bx bx-download"></i> Download</button></div></div><p class="gen-image-caption"><i class="bx bx-image-alt"></i> Here\u2019s your image for <em>"${shortPrompt}"</em> \u2014 click to preview or download above.</p></div>`;
                }

                setMessages(p => p.map(m =>
                    m.id === aiMsgId ? { ...m, content: htmlImg, html: htmlImg, loading: false, imageGen: false } : m
                ));
            } catch (e) {
                console.error('Image Gen error:', e);
                const errHtml = `<div class="img-gen-error"><i class="bx bx-error-circle"></i><span>\u274c ${e.message}</span></div>`;
                setMessages(p => p.map(m =>
                    m.id === aiMsgId ? { ...m, content: errHtml, html: errHtml, loading: false, imageGen: false } : m
                ));
            }
            setIsLoading(false);
            return;
        }

        const modelObj = MODELS.find(m => m.value === selectedModel) || MODELS[0];

        const formData = new FormData();
        formData.append('message', finalMessageContent);
        formData.append('email', user.email);
        formData.append('model', modelObj.gemini);

        formData.append('webSearch', webSearch ? 'true' : 'false');
        formData.append('isTemporary', isTemporary ? 'true' : 'false');
        if (currentSessionId) formData.append('sessionId', currentSessionId);

        // Append AI Preferences / Personalization
        formData.append('gender', settings.userGender || '');
        formData.append('ageGroup', settings.userAge || '');
        formData.append('language', settings.userLanguage || '');
        formData.append('culture', settings.userCulture || '');
        formData.append('writingStyle', settings.userWritingStyle || '');
        formData.append('creativityLevel', settings.userCreativity || '');
        formData.append('interests', settings.userInterests || '');
        formData.append('customRules', settings.userCustomRules || '');
        formData.append('voice', settings.userVoice || '');
        if (selectedFile) formData.append('image', selectedFile);
        formData.append('agentId', appMode || 'chat');

        // Send personalisation fields so the AI behaviour tab takes effect
        if (settings.userGender) formData.append('gender', settings.userGender);
        if (settings.userAge) formData.append('ageGroup', settings.userAge);
        if (settings.userLanguage) formData.append('language', settings.userLanguage);
        if (settings.userCulture) formData.append('culture', settings.userCulture);
        if (settings.userWritingStyle) formData.append('writingStyle', settings.userWritingStyle);
        if (settings.userCreativity) formData.append('creativityLevel', settings.userCreativity);
        if (settings.userInterests) formData.append('interests', settings.userInterests);
        if (settings.userCustomRules) formData.append('customRules', settings.userCustomRules);

        try {
            // streaming-aware animation variables
            let fullText = '';
            let displayedText = '';
            let isStreaming = true;
            const openIndices = new Set();

            const animateText = () => {
                if (displayedText.length < fullText.length) {
                    const bufferSize = fullText.length - displayedText.length;
                    const chunkSize = Math.max(1, Math.min(bufferSize, Math.ceil(bufferSize / STREAMING_SPEED_MODIFIER) + 1));
                    displayedText += fullText.slice(displayedText.length, displayedText.length + chunkSize);
                    let html = formatStreamedText(displayedText, true);

                    let count = 0;
                    html = html.replace(/<details class="think-block-details">/g, (match) => {
                        const isOpen = openIndices.has(count++);
                        return isOpen ? '<details class="think-block-details" open>' : match;
                    });

                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, html, loading: true } : m
                    ));
                    // Scroll only if user hasn't scrolled up
                    const box = chatboxRef.current;
                    if (box && !userScrolledUpRef.current) {
                        box.scrollTop = box.scrollHeight;
                    }
                    requestAnimationFrame(animateText);
                } else if (!isStreaming) {
                    // Final pass: ensure fullText is rendered with final formatting
                    let html = formatStreamedText(fullText, false);
                    let count = 0;
                    html = html.replace(/<details class="think-block-details">/g, (match) => {
                        const isOpen = openIndices.has(count++);
                        return isOpen ? '<details class="think-block-details" open>' : match;
                    });
                    
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, html, loading: false } : m
                    ));
                } else {
                    // Just wait for more text
                    requestAnimationFrame(animateText);
                }
            };
            requestAnimationFrame(animateText);

            await streamChat({
                formData,
                token: isGuest ? 'guest' : activeToken,
                onChunk: (chunk) => {
                    // accumulate the raw text; animation loop will pick it up
                    fullText += chunk;

                    if (!openPreviewSetRef.current) {
                        const openMatch = fullText.match(/Opened in Browser View:\s*(https?:\/\/[^\s<]+)/i);
                        if (openMatch?.[1]) {
                            setBrowserPreview({ action: 'open', previewUrl: openMatch[1], url: openMatch[1], title: '' });
                            openPreviewSetRef.current = true;
                        }
                    }
                },
                onSessionId: (sid) => {
                    if (!currentSessionId) {
                        ignoreNextSessionLoadRef.current = true;
                        setCurrentSessionId(sid);
                        loadSessions(1);
                        if (appMode === 'chat') {
                            navigate(`/chat/${sid}`, { replace: true });
                        } else {
                            navigate(`/apps/${appMode}/${sid}`, { replace: true });
                        }
                    }
                },
                onSources: (sources) => {
                    if (Array.isArray(sources)) {
                        setSourceLinks(sources);
                    }
                },
                onBrowserResult: (result) => {
                    if (result && typeof result === 'object') {
                        setBrowserPreview(result);
                        setShowEmbeddedPreview(false);
                    }
                },
                onAppCommand: (result) => {
                    if (result && result.command) {
                        const { action, payload } = result.command;
                        
                        switch (action) {
                            case 'update_theme':
                                if (payload.theme) {
                                    const newMode = payload.theme;
                                    setMode(newMode);
                                    localStorage.setItem('app-theme-mode', newMode);
                                    apiUpdateTheme(activeToken, newMode);
                                    showToast(`Theme updated to ${newMode} mode`);
                                }
                                break;

                            case 'navigation':
                                if (payload.target === 'gallery') setGalleryOpen(true);
                                if (payload.target === 'settings') {
                                    setSettingsOpen(true);
                                    setTempSettings({ ...settings, theme, mode });
                                }
                                if (payload.target === 'privacy') navigate('/privacy');
                                if (payload.target === 'help') showToast('Help center coming soon!');
                                break;

                            case 'manage_session':
                                if (payload.type === 'delete_session') setDeleteModal({ open: true, id: currentSessionId });
                                if (payload.type === 'clear_chat') startNewChat();
                                break;

                            case 'update_settings':
                                if (payload.field && payload.value !== undefined) {
                                    if (payload.field === 'userDefaultModel') {
                                        apiUpdateModel(activeToken, payload.value);
                                    }
                                    const updated = { ...settings, [payload.field]: payload.value };
                                    setSettings(updated);
                                    persistSettings(updated);
                                    showToast(`Updated ${payload.field.replace('user', '')} to ${payload.value}`);
                                }
                                break;
                            
                            case 'voice_control':
                                if (payload.enabled !== undefined) {
                                    apiUpdateVoice(activeToken, payload.enabled);
                                    const updated = { ...settings, voiceEnabled: payload.enabled };
                                    setSettings(updated);
                                    persistSettings(updated);
                                    showToast(payload.enabled ? "Voice responses enabled" : "Voice responses disabled");
                                }
                                break;

                            default:
                                console.warn("Unknown app command action:", action);
                        }
                    }
                },
                onEnd: () => {
                    isStreaming = false;
                    setIsLoading(false);

                    if (!openPreviewSetRef.current) {
                        const openMatch = fullText.match(/Opened in Browser View:\s*(https?:\/\/[^\s<]+)/i);
                        if (openMatch?.[1]) {
                            setBrowserPreview({ action: 'open', previewUrl: openMatch[1], url: openMatch[1], title: '' });
                            openPreviewSetRef.current = true;
                        }
                    }

                    const canvasRes = extractFrontendFromText(fullText);
                    if (canvasRes) {
                        setCanvasData(canvasRes);
                        setIsCanvasOpen(true);
                    }

                    // Final update to ensure content is properly stored
                    const html = formatStreamedText(fullText, false);
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText, html, loading: false } : m
                    ));
                },
                onError: (err) => {
                    isStreaming = false;
                    setIsLoading(false);
                    fullText = `âš ï¸ Error: ${err} `;
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText, html: fullText, loading: false } : m
                    ));
                },
            });
        } catch (e) {
            console.error('Chat error:', e);
            setIsLoading(false);
            setMessages(p => p.map(m =>
                m.id === aiMsgId ? { ...m, html: `âŒ ${e.message} `, loading: false } : m
            ));
        }
    }, [inputText, selectedFile, pastedContent, isLoading, selectedModel, webSearch, isTemporary, isImageGen, currentSessionId, user, isGuest, loadSessions, getFreshToken]);

    // â”€â”€ Helper Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleCopy = (id, text) => {
        const cleanText = text.replace(/<[^>]*>?/gm, '');
        navigator.clipboard.writeText(cleanText).then(() => {
            setCopiedMessageId(id);
            showToast('Copied to clipboard!');
            setTimeout(() => setCopiedMessageId(null), 2000);
        }).catch(() => showToast('Failed to copy'));
    };

    const handleShare = (text) => {
        const cleanText = text.replace(/<[^>]*>?/gm, '');
        if (navigator.share) {
            navigator.share({ title: 'Treevit Response', text: cleanText, url: window.location.href })
                .then(() => showToast('Shared successfully!'))
                .catch(() => handleCopy('share', cleanText));
        } else {
            handleCopy('share', cleanText);
        }
    };

    const handleShareSession = async () => {
        if (!currentSessionId) {
            showToast('Start a chat before sharing!');
            return;
        }
        try {
            const activeToken = await getFreshToken();
            await import('../../services/api').then(m => m.toggleSessionShare(user.email, currentSessionId, activeToken));
            const shareUrl = `${window.location.origin}/shared/${currentSessionId}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('Share link copied to clipboard!');
            });
        } catch (e) {
            console.error('Failed to share session', e);
            showToast('Failed to create share link.');
        }
    };

    const handleDownload = (text) => {
        const cleanText = text.replace(/<[^>]*>?/gm, '');
        const blob = new Blob([cleanText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `treevit-response-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Download started!');
    };

    const handleTranslate = async (messageId, text, langCode, langName) => {
        setTranslationMenu(null);
        showToast(`Translating to ${langName}...`);
        const cleanText = text.replace(/<[^>]*>?/gm, '');

        try {
            // Try MyMemory first
            let translated = '';
            const resMM = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=en|${langCode}`);
            const dataMM = await resMM.json();
            if (dataMM.responseStatus === 200) {
                translated = dataMM.responseData.translatedText;
            } else {
                // Fallback to Google
                const proxyUrl = 'https://api.allorigins.win/raw?url=';
                const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(cleanText)}`;
                const resG = await fetch(proxyUrl + encodeURIComponent(apiUrl));
                const dataG = await resG.json();
                if (dataG && Array.isArray(dataG[0])) {
                    translated = dataG[0].map(item => item[0]).join('');
                }
            }

            if (translated) {
                setTranslations(p => ({
                    ...p,
                    [messageId]: { langName, html: formatStreamedText(translated) }
                }));
                showToast(`Translated to ${langName}!`);
            } else {
                throw new Error('Translation failed');
            }
        } catch (e) {
            console.error(e);
            showToast('Translation failed. Please try again.');
        }
    };

    const handleSpeak = (messageId, text) => {
        if (window.speechSynthesis.speaking && speakingMessageId === messageId) {
            window.speechSynthesis.cancel();
            setSpeakingMessageId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const cleanText = text.replace(/<[^>]*>?/gm, '');
        const utter = new SpeechSynthesisUtterance(cleanText);

        if (settings.userVoice) {
            const voices = window.speechSynthesis.getVoices();
            const chosen = voices.find(v => v.name === settings.userVoice);
            if (chosen) utter.voice = chosen;
        }

        utter.onstart = () => setSpeakingMessageId(messageId);
        utter.onend = () => setSpeakingMessageId(null);
        utter.onerror = () => setSpeakingMessageId(null);

        window.speechSynthesis.speak(utter);
    };

    const handleRegenerate = (id) => {
        const idx = messages.findIndex(m => m.id === id);
        if (idx <= 0) return;
        const userMsg = messages[idx - 1];
        if (userMsg.role !== 'outgoing') return;

        // Remove the existing AI response and all subsequent messages
        setMessages(p => p.slice(0, idx));
        // Trigger send with the same user text
        handleSend(userMsg.content);
    };

    const handleStartEdit = (id, text) => {
        setEditingMessageId(id);
        setEditText(text);
    };

    const handleSaveEdit = (id) => {
        if (!editText.trim()) return;
        const idx = messages.findIndex(m => m.id === id);
        if (idx === -1) return;

        const nextText = editText.trim();

        setMessages(p => p.slice(0, idx + 1).map((msg, msgIdx) => (
            msgIdx === idx
                ? {
                    ...msg,
                    content: nextText,
                    rawContent: nextText,
                    editableText: nextText,
                    isHtml: false,
                    html: ''
                }
                : msg
        )));

        setEditingMessageId(null);
        handleSend(nextText, { reuseMessageId: id });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handlePaste = (e) => {
        const text = e.clipboardData.getData('text');
        if (text) {
            if (text.length > 500) {
                e.preventDefault();
                setPastedContent(text);
            }
        }
    };


    const handleDeleteSession = async (id) => {
        try {
            showToast('Deleting chat...');
            const activeToken = await getFreshToken();
            await deleteSession(user.email, id, activeToken);
            setSessions(p => p.filter(s => s._id !== id));
            if (currentSessionId === id) navigate('/chat');
            showToast('Chat deleted successfully');
        } catch (e) {
            console.error(e);
            showToast('Failed to delete chat: ' + e.message);
        }
        setDeleteModal({ open: false, id: null });
    };

    const activeSession = sessions.find(s => s._id === (sessionId || currentSessionId));
    const headerTitle = activeSession?.title || (sessionId ? "Loading session..." : "Treevit");

    const filteredSessions = sessions.filter(s =>
        s.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const profileInitial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();

    return (
        <div className="app-main-layout" style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                sidebarWidth={sidebarWidth}
                onResize={handleSidebarResize}
                user={user}
                logout={logout}
                isGuest={isGuest}
                appMode={appMode}
                setAppMode={setAppMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                startNewChat={startNewChat}
                filteredSessions={filteredSessions}
                sessionId={sessionId}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
                setDeleteModal={setDeleteModal}
                sessHasMore={sessHasMore}
                sessionsLoading={sessionsLoading}
                loadSessions={loadSessions}
                sessPage={sessPage}
                setSettingsOpen={() => {
                    setSettingsOpen(true);
                    setTempSettings({ ...settings, theme, mode });
                }}
                setAppsOpen={setAppsOpen}
                galleryCount={galleryImages.length}
                onOpenGallery={() => setGalleryOpen(true)}
                onOpenLegal={() => setLegalOpen(true)}
                isCanvasOpen={isCanvasOpen}
                setIsCanvasOpen={setIsCanvasOpen}
            />

            {/* Mobile Overlay */}
            <div 
                className={`sidebar-overlay ${sidebarOpen && isMobile ? 'active' : ''}`} 
                onClick={() => setSidebarOpen(false)} 
            />

         
            <section className="show-chatbot" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, background: 'var(--sarvam-bg-body, #F7F5F3)', overflow: 'hidden' }}>
                {appMode !== 'chat' && AGENTS.find(a => a.id === appMode)?.component ? (
                    (() => {
                        const agent = AGENTS.find(a => a.id === appMode);
                        const AgentComp = agent.component;
                        return (
                            <div className="chatbot" style={{ height: '100%', width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, boxShadow: 'none', background: 'var(--sarvam-bg-surface, #FFFFFF)' }}>
                                <header style={{ width: '100%', maxWidth: '100%', flexShrink: 0, margin: 0, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
                                    <div className="left-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: '10px', flex: 1, minWidth: 0 }}>
                                        <i className='bx bx-sidebar-right bx-flip-horizontal' id="btn-header-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: 'pointer' }} />
                                    </div>
                                    <div className="center-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {agent.logo ? (
                                                <img 
                                                    src={agent.logo} 
                                                    alt={agent.name} 
                                                    style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
                                                />
                                            ) : (
                                                <i className={`bx ${agent.icon}`} style={{ color: agent.color || 'var(--accent)' }} />
                                            )}
                                            {agent.name}
                                        </h2>
                                    </div>
                                    <div className="right-header" style={{ paddingRight: '10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                        <button
                                            onClick={() => navigate('/chat')}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                color: '#fff',
                                                padding: '4px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}
                                        >
                                            <i className='bx bx-x' /> Close
                                        </button>
                                    </div>
                                </header>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <AgentComp
                                        initialFile={(appMode === 'excel' || appMode === 'word') ? selectedFile : null}
                                        onClearFile={() => setSelectedFile(null)}
                                        settings={settings}
                                    />
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="chatbot" style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--sarvam-bg-surface, #FFFFFF)', overflow: 'hidden' }}>
                        {/* ── Full Width Header ── */}
                        <header style={{ 
                            width: '100%', 
                            maxWidth: '100%', 
                            flexShrink: 0, 
                            margin: 0, 
                            padding: '0 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: '56px'
                        }}>
                            <div className="left-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: '10px', flex: 1, minWidth: 0 }}>
                                <i 
                                    className='bx bx-sidebar-right bx-flip-horizontal' 
                                    id="btn-header-toggle" 
                                    onClick={() => setSidebarOpen(true)} 
                                    style={{ cursor: 'pointer', fontSize: '24px' }} 
                                />
                            </div>
                            <div className="center-header" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 20px' }}>
                                <h2 style={{ cursor: 'pointer', margin: 0, fontSize: '1.2rem' }} onClick={() => navigate('/chat')}>
                                    Treevit
                                </h2>
                            </div>
                            <div className="right-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', paddingRight: '10px', flex: 1, minWidth: 0 }}>
                                <div className="right-heder-bar" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                {!isReadOnly && (
                                    <>
                                        <button
                                            id="temp-chat-btn"
                                            className={`temp-chat-btn${isTemporary ? ' active' : ''}`}
                                            title={isTemporary ? 'Temporary chat ON â€” messages won\'t be saved. Click to disable.' : 'Enable temporary chat â€” messages won\'t be saved'}
                                            onClick={() => {
                                                const turningOn = !isTemporary;
                                                setIsTemporary(turningOn);
                                                if (turningOn) {
                                                    // Only start fresh if there's an active chat
                                                    if (messages.length > 0 || currentSessionId) {
                                                        startNewChat();
                                                    }
                                                    showToast('Temporary chat enabled â€” messages won\'t be saved');
                                                } else {
                                                    showToast('Temporary chat disabled â€” messages will be saved');
                                                }
                                            }}
                                        >
                                            <i className={`bx ${isTemporary ? 'bx-eye' : 'bx-eye-slash'}`} />
                                            <span>{isTemporary ? 'Temp' : 'Temp'}</span>
                                        </button>
                                        <i
                                            className='bx bx-forward-big'
                                            onClick={handleShareSession}
                                            title="Share Chat"
                                            style={{ cursor: 'pointer', marginLeft: 15 }}
                                        />

                                        {/* Canvas Toggle removed per user request */}

                                        {(sourceLinks.length > 0 || browserPreview) && (
                                            <button
                                                className={`browser-toggle-btn ${showBrowserPanel ? 'active' : ''}`}
                                                onClick={toggleBrowserPanel}
                                                title={showBrowserPanel ? "Hide Research Panel" : "Show Research Panel"}
                                                style={{
                                                    background: showBrowserPanel ? 'var(--sarvam-accent, #6EE7B7)' : 'rgba(255,255,255,0.1)',
                                                    color: showBrowserPanel ? '#000' : '#fff',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    marginLeft: '15px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <i className='bx bx-globe' />
                                                <span className="hide-mobile">Browser</span>
                                            </button>
                                        )}
                                    </>
                                )}
                                <div>
                                </div>
                            </div>
                        </div>
                    </header>

                        {/* ── Main Content Area (Side-by-Side) ── */}
                        <div className={`chatbot-content-area ${isCanvasOpen ? 'canvas-active' : ''}`}>
                            <div className="chatbot-main-section">
                                {/* ── Chatbox ── */}
                        <div className="chatbox" ref={chatboxRef}>
                            {/* Home / Welcome screen */}
                            {showHome && (
                                <div className="home-tag-content" id="home-tag-contentID">
                                    <div className="welcome-section">
                                        <div className="welcome-header">
                                            <h1 className="Greet-tag" id="Greet-tag">{greeting}</h1>
                                            <br />
                                        </div>
                                    </div>

                                    <div className="suggestions-grid">
                                        {SUGGESTIONS.map(s => (
                                            <div
                                                key={s.id}
                                                className="suggestion-card"
                                                id={s.id}
                                                onClick={() => handleSend(s.text)}
                                            >
                                                <div className="card-icon" style={{ background: s.accent }}>
                                                    <i className={`bx ${s.icon}`} />
                                                </div>
                                                <div className="card-content">
                                                    <h3>{s.title}</h3>
                                                    <p>{s.text}</p>
                                                </div>
                                                <i className="bx bx-send card-send-icon" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Messages */}
                            {messages.map((msg, index) => (
                                msg.role === 'incoming' ? (
                                    <div key={msg.id} className="chat incoming" id={msg.id}>
                                        {msg.loading && !msg.html ? (
                                            msg.imageGen ? (
                                                /* â”€â”€ Image generation loading animation â”€â”€ */
                                                <div className="premium-image-loader">
                                                    <div className="img-gen-shimmer" />
                                                    <div className="img-gen-loader-text">
                                                        <i className="bx bx-image-alt img-gen-icon" />
                                                        <span>Sketching</span>
                                                    </div>
                                                    <div className="img-gen-bar-wrap">
                                                        <div className="img-gen-bar" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="chat-spinner" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center' }}>
                                                 <TreevitLoader/>
                                                </div>
                                            )
                                        ) : (
                                            <>
                                                <div className="chat-content" style={msg.loading && !msg.html ? { background: 'none', padding: '0', borderRadius: '0' } : {}}>
                                                    <AnimatedMessage html={msg.html} message={msg.content} isLoading={msg.loading} />
                                                </div>
                                                {/* Translation Result */}
                                                {translations[msg.id] && (
                                                    <div className="translation-result">
                                                        <div className="translation-header">
                                                            <i className='bx bx-translate'></i>
                                                            <span>{translations[msg.id].langName}</span>
                                                            <i className='bx bx-x close-translation' onClick={() => {
                                                                setTranslations(p => {
                                                                    const next = { ...p };
                                                                    delete next[msg.id];
                                                                    return next;
                                                                });
                                                            }}></i>
                                                        </div>
                                                        <MarkdownContent className="translation-content" html={translations[msg.id].html} />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {!msg.loading && msg.content && !msg.content.includes("âŒ Image Gen") && (
                                            <div className="chat-actions" style={{ display: 'flex' }}>
                                                <button
                                                    className={`action-btn copy-btn ${copiedMessageId === msg.id ? 'copied' : ''}`}
                                                    title="Copy"
                                                    onClick={() => handleCopy(msg.id, msg.rawContent || msg.content)}
                                                >
                                                    <i className={`bx ${copiedMessageId === msg.id ? 'bx-check' : 'bx-copy'}`}></i>
                                                </button>
                                                <button className="action-btn share-btn" title="Share" onClick={() => handleShare(msg.content)}>
                                                    <i className="bx bx-share-alt"></i>
                                                </button>
                                                <button className="action-btn download-btn" title="Download" onClick={() => handleDownload(msg.content)}>
                                                    <i className="bx bx-download"></i>
                                                </button>
                                                <button
                                                    className="action-btn translate-btn"
                                                    title="Translate"
                                                    onClick={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setTranslationMenu({
                                                            messageId: msg.id,
                                                            text: msg.content,
                                                            x: rect.left,
                                                            y: rect.top - 310 > 0 ? rect.top - 310 : rect.bottom + 10
                                                        });
                                                    }}
                                                >
                                                    <i className="bx bx-translate"></i>
                                                </button>
                                                <button
                                                    className={`action-btn speak-btn ${speakingMessageId === msg.id ? 'speaking' : ''}`}
                                                    title="Listen"
                                                    onClick={() => handleSpeak(msg.id, msg.content)}
                                                >
                                                    <i className={`bx ${speakingMessageId === msg.id ? 'bx-stop' : 'bx-volume-full'}`}></i>
                                                </button>
                                                {!isReadOnly && (
                                                    <button className="action-btn regenerate" title="Regenerate" onClick={() => handleRegenerate(msg.id)}>
                                                        <i className="bx bx-refresh"></i>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        key={msg.id}
                                        className="chat outgoing"
                                        id={msg.id}
                                        style={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end' }}
                                    >
                                        <div className="outgoing-shell">
                                            {editingMessageId === msg.id ? (
                                                <div className="inline-edit-container">
                                                    <div className="edit-wrapper">
                                                        <textarea
                                                            className="edit-textarea"
                                                            value={editText}
                                                            onChange={(e) => setEditText(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <div className="edit-btn-group">
                                                            <button className="edit-save-btn" onClick={() => handleSaveEdit(msg.id)}>Save & Submit</button>
                                                            <button className="edit-cancel-btn" onClick={() => setEditingMessageId(null)}>Cancel</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="outgoing-message-body">
                                                    {msg.isHtml ? (
                                                        <MarkdownContent className="chat-content user-rich-content" html={msg.content} />
                                                    ) : (
                                                        <div className="chat-content user-plain-content">{msg.content}</div>
                                                    )}
                                                    <div className="user-chat-actions">
                                                        <button
                                                            className={`action-btn copy-btn ${copiedMessageId === msg.id ? 'copied' : ''}`}
                                                            title="Copy text"
                                                            onClick={() => handleCopy(msg.id, msg.rawContent || msg.content)}
                                                        >
                                                            <i className={`bx ${copiedMessageId === msg.id ? 'bx-check' : 'bx-copy'}`}></i>
                                                        </button>
                                                        {!isReadOnly && (
                                                            <button className="action-btn edit-btn" title="Edit message" onClick={() => handleStartEdit(msg.id, msg.editableText || msg.rawContent?.replace(/<[^>]*>?/gm, '') || msg.content?.replace(/<[^>]*>?/gm, ''))}>
                                                                <i className="bx bx-pencil"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>

                        {/* Translation Dropdown Menu */}
                        {translationMenu && (
                            <div
                                className="translation-dropdown show"
                                style={{
                                    position: 'fixed',
                                    top: translationMenu.y,
                                    left: translationMenu.x,
                                    zIndex: 1000,
                                    maxHeight: '300px',
                                    overflowY: 'auto'
                                }}
                                onMouseLeave={() => setTranslationMenu(null)}
                            >
                                {LANGUAGES.map(lang => (
                                    <div
                                        key={lang.code}
                                        className="translation-option"
                                        onClick={() => handleTranslate(translationMenu.messageId, translationMenu.text, lang.code, lang.name)}
                                    >
                                        <span style={{ width: '20px', textAlign: 'center', marginRight: '8px' }}>{lang.flag}</span>
                                        <span>{lang.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* â”€â”€ Scroll-to-bottom FAB â”€â”€ */}
                        <button
                            className={`scroll-to-bottom-btn${showScrollBtn ? ' visible' : ''}`}
                            title="Scroll to bottom"
                            onClick={() => {
                                const box = chatboxRef.current;
                                if (box) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
                            }}
                        >
                            <i className="bx bx-chevron-down" />
                        </button>

                        {/* â”€â”€ Chat Input â”€â”€ */}
                        {!isReadOnly && (
                            <div className="input-area">
                                <div className="input-box" id="chat-input" style={{ position: 'relative' }}>
                                    
                                    <div className="previews-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {/* File preview */}
                                        {selectedFile && (
                                            <div id="file-preview" className="file-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {selectedFile.type.startsWith('image/') ? (
                                                    <img src={URL.createObjectURL(selectedFile)} alt="preview" className="preview-thumbnail" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                                                ) : (
                                                    <i className="bx bx-file file-chip-icon" style={{ fontSize: '18px' }} />
                                                )}
                                                <span className="file-chip-name">{selectedFile.name}</span>
                                                <button className="file-chip-remove" title="Remove file" onClick={() => setSelectedFile(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                    <i className="bx bx-x" style={{ fontSize: '16px' }} />
                                                </button>
                                            </div>
                                        )}
                                        {/* Pasted Text Preview */}
                                        {pastedContent && (
                                            <div id="pasted-text-preview" className="file-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <i className="bx bx-text file-chip-icon" style={{ fontSize: '18px' }} />
                                                <span className="file-chip-name">{pastedContent.length > 30 ? pastedContent.substring(0, 30) + '...' : pastedContent}</span>
                                                <button className="file-chip-remove" title="Remove pasted text" onClick={() => setPastedContent('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                    <i className="bx bx-x" style={{ fontSize: '16px' }} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <textarea
                                        ref={textareaRef}
                                        placeholder={isImageGen ? 'Describe image to generate...' : 'Ask anything...'}
                                        required
                                        id="inputa"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                        rows={1}
                                    />

                                    <div className="input-toolbar">
                                        {/* Left tools */}
                                        <div className="input-toolbar-left" style={{ position: 'relative' }}>
                                            <button
                                                className={`toolbar-icon-btn ${showActionsMenu ? 'active' : ''}`}
                                                id="plus-btn"
                                                title="More Options"
                                                onClick={e => { e.stopPropagation(); setShowActionsMenu(p => !p); }}
                                            >
                                                <i className='bx bx-plus' style={{ fontSize: '20px' }} />
                                            </button>

                                            {/* Actions menu */}
                                            {showActionsMenu && (
                                                <div className="input-actions-menu show" id="input-actions-menu" style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 100 }}>
                                                    <div className="menu-item list-item">
                                                        <label htmlFor="file-upload" className="menu-icon-btn" title="Upload File" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                            <i className="bx bx-md bx-paperclip" />
                                                            <span>Upload File</span>
                                                        </label>
                                                        <input
                                                            type="file"
                                                            id="file-upload"
                                                            accept="image/*, audio/*, video/*, .pdf, .txt, .js, .py, .java, .c, .cpp, .html, .css, .json, .md, .csv, .xml, .rtf"
                                                            hidden
                                                            ref={fileInputRef}
                                                            onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    setSelectedFile(file);
                                                                    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
                                                                    if (excelAssistEnabled && isExcel) {
                                                                        setAppMode('excel');
                                                                    }
                                                                }
                                                                setShowActionsMenu(false);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="menu-item list-item">
                                                        <div
                                                            className={`menu-icon-btn${webSearch ? ' active' : ''}`}
                                                            id="web-search"
                                                            title="Google Web Search"
                                                            onClick={() => { setWebSearch(p => !p); setShowActionsMenu(false); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                                        >
                                                            <i className='bx bx-md bxl-google' />
                                                            <span>Google Search</span>
                                                        </div>
                                                    </div>

                                                    <div className="menu-item list-item">
                                                        <div
                                                            className={`menu-icon-btn${isImageGen ? ' active' : ''}`}
                                                            id="generate-image-btn"
                                                            title="Generate Image"
                                                            onClick={() => { setIsImageGen(p => !p); setShowActionsMenu(false); }}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                                        >
                                                            <i className='bx bx-md bx-image-add' />
                                                            <span>Generate Image</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right tools */}
                                        <div className="input-toolbar-right" style={{ position: 'relative' }}>
                                            {/* Model selector */}
                                            <div className={`model-pill ${showModelOptions ? 'active' : ''}`} onClick={() => setShowModelOptions(p => !p)}>
                                                <span id="model-display">{MODELS.find(m => m.value === selectedModel)?.label || 'Auto'}</span>
                                                <i className='bx bx-chevron-down' style={{ fontSize: '16px' }} />
                                            </div>
                                            {showModelOptions && (
                                                <div className="model-options show" id="model-options" style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', zIndex: 100, minWidth: '200px', background: 'var(--sarvam-bg-surface)', border: '1px solid var(--sarvam-border)', borderRadius: '16px', padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                    {MODELS.map(m => (
                                                        <div
                                                            key={m.value}
                                                            className={`model-option${selectedModel === m.value ? ' selected' : ''}`}
                                                            data-value={m.value}
                                                            title={m.title}
                                                            onClick={() => {
                                                                setSelectedModel(m.value);
                                                                setShowModelOptions(false);
                                                            }}
                                                            style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                        >
                                                            {m.label}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Mic button */}
                                            <button className="mic-btn" id="mic-btn" title="Start speaking" onClick={toggleListening}>
                                                <i className={`bx ${isListening ? 'bx-loader bx-spin' : 'bxs-microphone'}`} style={{ fontSize: '20px' }} />
                                            </button>

                                            {/* Send button */}
                                            <button
                                                className="send-btn"
                                                id="send-button"
                                                onClick={() => handleSend()}
                                                disabled={isLoading}
                                                style={{ opacity: isLoading ? 0.5 : 1 }}
                                            >
                                                <i className='bx bxs-up-arrow' />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <p className="chat-disclaimer">Treevit can make mistakes. Verify important information.</p>
                            </div>
                        )}
                    </div>

                        {/* ── Canvas Panel ── */}
                        {isCanvasOpen && (
                            <div className="canvas-panel-wrapper">
                                <Canvas 
                                    isOpen={isCanvasOpen}
                                    onClose={() => setIsCanvasOpen(false)}
                                    type={canvasData.type}
                                    title={canvasData.title}
                                    content={canvasData.content}
                                />
                            </div>
                        )}

                        {/* ── Browser Panel with Resizer ── */}
                    {(sourceLinks.length > 0 || browserPreview) && (
                        <>
                            {showBrowserPanel && browserPreview?.previewUrl && (
                                <div 
                                    className="browser-resizer" 
                                    onMouseDown={startResizing}
                                    style={{
                                        width: '4px',
                                        cursor: 'col-resize',
                                        zIndex: 1300,
                                        background: isResizing ? 'var(--sarvam-accent, #6EE7B7)' : 'transparent',
                                        height: '100%',
                                        transition: 'background 0.2s',
                                        flexShrink: 0
                                    }}
                                />
                            )}
                            <aside 
                                className={`browser-side-panel ${showBrowserPanel ? 'panel-open' : 'panel-closed'}`}
                                    style={{
                                        position: 'relative',
                                        height: '100%',
                                        width: showBrowserPanel ? (browserPreview?.previewUrl ? `${browserWidth}px` : '400px') : '0px',
                                        opacity: showBrowserPanel ? 1 : 0,
                                        flexShrink: 0,
                                        margin: 0,
                                        borderRadius: 0,
                                        borderLeft: showBrowserPanel ? '1px solid var(--browser-border)' : 'none',
                                        zIndex: 5,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        transition: isResizing ? 'none' : 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, border-left 0.4s ease',
                                        overflow: 'hidden',
                                        pointerEvents: showBrowserPanel ? 'auto' : 'none'
                                    }}
                                >
                                            <div className="browser-side-panel-header">
                                                <div className="browser-header-left">
                                                    <button className="mobile-browser-close" onClick={() => setShowBrowserPanel(false)}>
                                                        <i className='bx bx-chevron-left'></i>
                                                    </button>
                                                    <h4>Browser View</h4>
                                                </div>
                                                <div className="browser-view-type-badge">
                                                    {browserPreview?.url ? (
                                                        <span className="badge-live"><i className='bx bxs-circle'></i> Live Result</span>
                                                    ) : (
                                                        <span className="badge-sources"><i className='bx bx-list-ul'></i> Sources</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="browser-panel-content" style={{ flex: 1, overflowY: 'auto' }}>
                                                {browserPreview?.previewUrl && (
                                                    <div className="browser-side-frame-wrap">
                                                        {browserPreview?.screenshotBase64 && !showEmbeddedPreview ? (
                                                            <img
                                                                className="browser-side-frame-shot"
                                                                src={`data:image/png;base64,${browserPreview.screenshotBase64}`}
                                                                alt="Captured page"
                                                            />
                                                        ) : (
                                                            <iframe
                                                                className="browser-side-frame"
                                                                src={browserPreview.previewUrl}
                                                                title="Browser Preview"
                                                                loading="lazy"
                                                            />
                                                        )}
                                                        <div className="browser-side-link-row">
                                                            {browserPreview?.screenshotBase64 && (
                                                                <button
                                                                    type="button"
                                                                    className="browser-side-embed-toggle"
                                                                    onClick={() => setShowEmbeddedPreview((prev) => !prev)}
                                                                >
                                                                    <i className={`bx ${showEmbeddedPreview ? 'bx-image' : 'bx-pointer'}`}></i>
                                                                    <span>{showEmbeddedPreview ? 'Show Screenshot' : 'Try Live Embed'}</span>
                                                                </button>
                                                            )}
                                                            <a className="browser-side-open-btn" href={browserPreview.previewUrl} target="_blank" rel="noreferrer">
                                                                <i className='bx bx-link-external'></i>
                                                                <span>Open in new tab</span>
                                                            </a>
                                                        </div>

                                                        {(browserPreview?.summary || browserPreview?.snippet) && (
                                                            <div className="browser-summary-container">
                                                                <h5>Website Detail</h5>
                                                                <div className="browser-summary-content">
                                                                    {browserPreview.summary || browserPreview.snippet}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {browserPreview?.screenshotBase64 && !showEmbeddedPreview && (
                                                            <p className="browser-side-note">
                                                                Some websites block iframe preview. Showing captured browser output.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {(browserPreview?.title || browserPreview?.summary || (!browserPreview?.previewUrl && browserPreview?.screenshotBase64)) && (
                                                    <div className="browser-side-card">
                                                        {browserPreview?.url && (
                                                            <div className="browser-result-url-row">
                                                                <i className='bx bx-globe' style={{ fontSize: '12px', marginRight: '6px', opacity: 0.7 }}></i>
                                                                <span className="browser-result-url">{new URL(browserPreview.url).hostname}</span>
                                                            </div>
                                                        )}
                                                        {browserPreview?.title && (
                                                            <a href={browserPreview.url} target="_blank" rel="noreferrer" className="browser-result-title">
                                                                {browserPreview.title}
                                                            </a>
                                                        )}
                                                        {browserPreview?.summary && (
                                                            <p className="browser-result-snippet">{browserPreview.summary}</p>
                                                        )}
                                                        {!browserPreview?.previewUrl && browserPreview?.screenshotBase64 && (
                                                            <img
                                                                className="browser-side-shot"
                                                                src={`data:image/png;base64,${browserPreview.screenshotBase64}`}
                                                                alt="Captured page"
                                                            />
                                                        )}
                                                    </div>
                                                )}

                                                {sourceLinks.length > 0 && (
                                                    <div className="browser-side-sources">
                                                        <h5>Sources</h5>
                                                        <div className="sources-list-container">
                                                            {sourceLinks.map((source, index) => {
                                                                const domain = source.domain || (source.link ? new URL(source.link).hostname.replace('www.', '') : '');
                                                                const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';
                                                                
                                                                return (
                                                                    <a key={`${source.link}-${index}`} href={source.link} target="_blank" rel="noreferrer" className="browser-source-card">
                                                                        <div className="source-card-top">
                                                                            {faviconUrl && (
                                                                                <div className="source-card-favicon">
                                                                                    <img src={faviconUrl} alt="" onError={(e) => e.target.style.display = 'none'} />
                                                                                </div>
                                                                            )}
                                                                            <span className="source-card-title">{source.title || source.link}</span>
                                                                        </div>
                                                                        <div className="source-card-domain">{domain}</div>
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </aside>
                                    </>
                                )}
                            </div>

                        {/* ── Speaking Overlay ── */}
                        <div id="speaking-overlay" className={`speaking-overlay ${isListening ? 'show' : ''}`} style={{ display: isListening ? 'flex' : 'none' }}>
                            <div className="speaking-modal">
                                <div className="speaking-waveform">
                                    {[...Array(7)].map((_, i) => <div key={i} className="wave-bar" />)}
                                </div>
                                <p className="speaking-label">Listening<span className="dots"><span>.</span><span>.</span><span>.</span></span></p>
                                <p id="live-transcript" className="live-transcript">{liveTranscript}</p>
                                <button id="stop-speaking-btn" className="stop-speaking-btn" onClick={toggleListening}><i className='bx bx-stop-circle' /> Stop</button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {deleteModal.open && (
                <div id="delete-confirm-modal" className="confirm-modal show">
                    <div className="confirm-modal-content">
                        <div className="confirm-modal-header">
                            <i className='bx bx-error-circle' />
                            <h3>Delete Chat</h3>
                        </div>
                        <div className="confirm-modal-body">
                            <p>Are you sure you want to delete this chat? This action cannot be undone.</p>
                        </div>
                        <div className="confirm-modal-footer">
                            <button className="confirm-btn-cancel" onClick={() => setDeleteModal({ open: false, id: null })}>Cancel</button>
                            <button className="confirm-btn-delete" onClick={() => handleDeleteSession(deleteModal.id)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          GALLERY MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {galleryOpen && (
                <div className="gallery-modal" onClick={(e) => { if (e.target === e.currentTarget) setGalleryOpen(false); }}>
                    <div className="gallery-modal-content">
                        <div className="gallery-modal-header">
                            <div className="gallery-title">
                                <i className='bx bx-images' />
                                <h3>Image Gallery</h3>
                                <span className="gallery-count">{galleryImages.length} image{galleryImages.length !== 1 ? 's' : ''}</span>
                            </div>
                            <button className="gallery-close-btn" onClick={() => setGalleryOpen(false)}>
                                <i className='bx bx-x' />
                            </button>
                        </div>
                        <div className="gallery-modal-body">
                            {galleryImages.length === 0 ? (
                                <div className="gallery-empty">
                                    <i className='bx bx-image-add' />
                                    <p>No images generated yet</p>
                                    <span>Generate images using the image mode button in the chat input</span>
                                </div>
                            ) : (
                                <div className="gallery-grid">
                                    {galleryImages.map((img, i) => (
                                        <div key={img.ts} className="gallery-item">
                                            <div className="gallery-item-img-wrap">
                                                <img
                                                    src={img.src}
                                                    alt={img.prompt}
                                                    onClick={() => window.previewGeneratedImage({ src: img.src })}
                                                />
                                                <div className="gallery-item-overlay">
                                                    <button
                                                        className="gen-img-btn gen-preview-btn"
                                                        onClick={() => window.previewGeneratedImage({ src: img.src })}
                                                    >
                                                        <i className='bx bx-fullscreen' /> View
                                                    </button>
                                                    <button
                                                        className="gen-img-btn gen-download-btn"
                                                        onClick={() => {
                                                            const a = document.createElement('a');
                                                            a.href = img.src;
                                                            a.download = `chatterbox-image-${img.ts}.png`;
                                                            a.click();
                                                        }}
                                                    >
                                                        <i className='bx bx-download' /> Save
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="gallery-item-prompt">{img.prompt.length > 60 ? img.prompt.slice(0, 60) + 'â€¦' : img.prompt}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SETTINGS MODAL â€” exact original structure
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
            {
                settingsOpen && (
                    <div id="settings-modal" className="settings-modal show">
                        <div className="settings-modal-content">
                            <div className="settings-header">
                                <h3><i className='bx bx-cog' /> Settings</h3>
                                <i className='bx bx-x' id="close-settings" onClick={requestCloseSettings} />
                            </div>
                            <div className="settings-container">
                                <div className="settings-sidebar">
                                    {['general', 'ai-behavior', 'voice'].map(tab => (
                                        <button
                                            key={tab}
                                            className={`settings-tab-btn${settingsTab === tab ? ' active' : ''}`}
                                            data-tab={tab}
                                            onClick={() => setSettingsTab(tab)}
                                        >
                                            <i className={`bx ${tab === 'general' ? 'bx-user' : tab === 'ai-behavior' ? 'bx-brain' : 'bx-volume-full'}`} />
                                            {tab === 'general' ? 'General' : tab === 'ai-behavior' ? 'AI Behavior' : 'Voice'}
                                        </button>
                                    ))}
                                </div>
                                <div className="settings-body">
                                    {/* General Tab */}
                                    {settingsTab === 'general' && (
                                        <div id="tab-general" className="settings-tab-content active">
                                            <form id="settings-form" onSubmit={handleSaveGeneral}>
                                                <div className="form-group">
                                                    <label>Gender</label>
                                                    <CustomSelect
                                                        id="user-gender"
                                                        value={tempSettings.userGender}
                                                        onChange={v => setTempSettings(s => ({ ...s, userGender: v }))}
                                                        placeholder="Prefer not to say"
                                                        options={[
                                                            { value: '', label: 'Prefer not to say' },
                                                            { value: 'male', label: 'Male' },
                                                            { value: 'female', label: 'Female' },
                                                            { value: 'other', label: 'Other' },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>Age Group</label>
                                                    <CustomSelect
                                                        id="user-age"
                                                        value={tempSettings.userAge}
                                                        onChange={v => setTempSettings(s => ({ ...s, userAge: v }))}
                                                        placeholder="Select Age Group"
                                                        options={[
                                                            { value: '', label: 'Select Age Group' },
                                                            { value: 'child', label: 'Child (â‰¤12)' },
                                                            { value: 'teen', label: 'Teen / Gen-Z (13-22)' },
                                                            { value: 'adult', label: 'Adult (23-45)' },
                                                            { value: 'older', label: 'Older Adult (46+)' },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-language">Mother Tongue / Primary Language</label>
                                                    <input
                                                        type="text"
                                                        id="user-language"
                                                        placeholder="e.g., Tamil, Spanish, Hindi"
                                                        value={tempSettings.userLanguage}
                                                        onChange={e => setTempSettings(s => ({ ...s, userLanguage: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-culture">Cultural Background</label>
                                                    <input
                                                        type="text"
                                                        id="user-culture"
                                                        placeholder="e.g., South Indian, Western, Japanese"
                                                        value={tempSettings.userCulture}
                                                        onChange={e => setTempSettings(s => ({ ...s, userCulture: e.target.value }))}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>Theme Style</label>
                                                    <div className="theme-picker" id="theme-picker">
                                                        {['classic', 'sarvam'].map(t => (
                                                            <div
                                                                key={t}
                                                                className={`theme-card${tempSettings.theme === t ? ' selected' : ''}${t === 'classic' ? ' coming-soon' : ''}`}
                                                                data-theme={t}
                                                                onClick={() => {
                                                                    if (t === 'classic') {
                                                                        showToast('Cosmos theme is coming soon!', 'info');
                                                                        return;
                                                                    }
                                                                    setTempSettings(s => ({ ...s, theme: t }));
                                                                }}
                                                            >
                                                                <div className={`theme-card-preview ${t}-preview`}>
                                                                    <div className="tp-header" />
                                                                    <div className="tp-body">
                                                                        <div className="tp-sidebar" />
                                                                        <div className="tp-content">
                                                                            <div className="tp-msg tp-msg-in" />
                                                                            <div className="tp-msg tp-msg-out" />
                                                                            <div className="tp-msg tp-msg-in short" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="theme-card-info">
                                                                    <span className="theme-name">{t === 'classic' ? 'Cosmos' : 'Lumina'}</span>
                                                                    <span className="theme-desc">{t === 'classic' ? 'Coming Soon' : 'Elegant & Minimalist'}</span>
                                                                </div>
                                                                {t === 'classic' ? (
                                                                    <div className="theme-card-lock"><i className='bx bx-lock-alt' /></div>
                                                                ) : (
                                                                    <div className="theme-card-check"><i className='bx bx-check' /></div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label>Colour Mode</label>
                                                    <div className="mode-segment" id="mode-picker">
                                                        {['dark', 'light'].map(m => (
                                                            <button
                                                                key={m}
                                                                className={`mode-seg-btn${tempSettings.mode === m ? ' selected' : ''}`}
                                                                type="button"
                                                                data-mode={m}
                                                                onClick={() => setTempSettings(s => ({ ...s, mode: m }))}
                                                            >
                                                                <i className={`bx ${m === 'dark' ? 'bxs-moon' : 'bxs-sun'}`} />
                                                                <span>{m === 'dark' ? 'Dark' : 'Light'}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="form-group">
                                                    <label>Heatwave Mode</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                                        <button
                                                            type="button"
                                                            className={`mode-seg-btn${tempSettings.heatwaveMode ? ' selected' : ''}`}
                                                            onClick={() => setTempSettings(s => ({ ...s, heatwaveMode: !s.heatwaveMode }))}
                                                            style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '13px' }}
                                                        >
                                                            <i className={`bx ${tempSettings.heatwaveMode ? 'bx-toggle-right' : 'bx-toggle-left'}`} style={{ fontSize: '18px' }} />
                                                            <span>{tempSettings.heatwaveMode ? 'Enabled' : 'Disabled'}</span>
                                                        </button>
                                                        <span style={{ fontSize: '12px', color: 'var(--sarvam-text-secondary)' }}>Enhance response creativity and variety.</span>
                                                    </div>
                                                </div>

                                                <div className="settings-actions">
                                                    <button type="submit" className="save-btn" disabled={isSaving}>
                                                        {isSaving ? 'Saving...' : 'Save Preferences'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                    {/* AI Behavior Tab */}
                                    {settingsTab === 'ai-behavior' && (
                                        <div id="tab-ai-behavior" className="settings-tab-content active">
                                            <form id="ai-behavior-form" onSubmit={handleSaveAiBehavior}>
                                                <div className="form-group custom-select-wrapper-group">
                                                    <label>Default AI Model Base</label>
                                                    <CustomSelect
                                                        id="user-default-model"
                                                        value={tempSettings.userDefaultModel}
                                                        onChange={v => setTempSettings(s => ({ ...s, userDefaultModel: v }))}
                                                        placeholder="Select Model"
                                                        options={MODELS}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>AI Writing Style</label>
                                                    <CustomSelect
                                                        id="user-writing-style"
                                                        value={tempSettings.userWritingStyle}
                                                        onChange={v => setTempSettings(s => ({ ...s, userWritingStyle: v }))}
                                                        placeholder="Balanced & Natural"
                                                        options={[
                                                            { value: '', label: 'Balanced & Natural' },
                                                            { value: 'concise', label: 'Direct & Concise (No fluff)' },
                                                            { value: 'professional', label: 'Professional & Academic' },
                                                            { value: 'sarcastic', label: 'Witty & Sarcastic' },
                                                            { value: 'storyteller', label: 'Creative Storyteller' },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>Creativity Level</label>
                                                    <CustomSelect
                                                        id="user-creativity"
                                                        value={tempSettings.userCreativity}
                                                        onChange={v => setTempSettings(s => ({ ...s, userCreativity: v }))}
                                                        placeholder="Standard"
                                                        options={[
                                                            { value: '', label: 'Standard' },
                                                            { value: 'precise', label: 'Highly Precise & Logical' },
                                                            { value: 'creative', label: 'Highly Creative & Brainstorming' },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-interests">Your Core Interests (AI will tailor examples)</label>
                                                    <input
                                                        type="text"
                                                        id="user-interests"
                                                        value={tempSettings.userInterests}
                                                        onChange={e => setTempSettings(s => ({ ...s, userInterests: e.target.value }))}
                                                        placeholder="e.g., Coding, Sci-Fi, Investing, Gaming"
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-custom-rules">Custom Instructions / Rules</label>
                                                    <textarea
                                                        id="user-custom-rules"
                                                        rows="3"
                                                        value={settings.userCustomRules}
                                                        onChange={e => setSettings(s => ({ ...s, userCustomRules: e.target.value }))}
                                                        placeholder="e.g., Always reply in bullet points. Never use emojis. Treat me like a senior developer."
                                                    />
                                                </div>

                                                <div className="settings-actions">
                                                    <button type="submit" className="save-btn">Save AI Behavior</button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                    {/* Voice Tab */}
                                    {settingsTab === 'voice' && (
                                        <div id="tab-voice" className="settings-tab-content active">
                                            <div className="form-group">
                                                <label>Preferred Voice</label>
                                                <CustomSelect
                                                    id="voice-value"
                                                    value={settings.userVoice}
                                                    onChange={v => setSettings(s => ({ ...s, userVoice: v }))}
                                                    placeholder="Select Voice"
                                                    options={availableVoices.length > 0 ? availableVoices : [{ value: '', label: 'Select Voice' }]}
                                                />
                                                <p className="settings-hint">Select the voice you want to hear when using the "Speak" feature.</p>
                                            </div>
                                            <div className="form-group">
                                                <button id="test-voice-btn" className="secondary-btn" onClick={() => {
                                                    if (!settings.userVoice) return alert('Select a voice first.');
                                                    const u = new SpeechSynthesisUtterance("Hello, I'm your AI assistant.");
                                                    const voices = window.speechSynthesis.getVoices();
                                                    u.voice = voices.find(v => v.name === settings.userVoice);
                                                    window.speechSynthesis.speak(u);
                                                }}><i className='bx bx-play' /> Test Voice</button>
                                            </div>
                                            <div className="settings-actions">
                                                <button id="save-voice-btn" className="save-btn" type="button" onClick={handleSaveGeneral}>Save Voice Settings</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Unsaved Changes Prompt */}
            {showUnsavedPrompt && (
                <div className="modal-overlay">
                    <div className="confirm-modal">
                        <div className="confirm-header">
                            <i className='bx bx-error-circle' />
                            <h3>Unsaved Changes</h3>
                        </div>
                        <div className="confirm-body">
                            <p style={{ fontWeight: 500, color: 'var(--sarvam-text-main)' }}>You have modified your preferences, but they have not been saved yet.</p>
                            <p>If you leave this page without saving, all changes will be lost.</p>
                        </div>
                        <div className="confirm-footer" style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: '16px' }}>
                            <button className="confirm-btn cancel-btn" onClick={() => setShowUnsavedPrompt(false)} style={{ background: 'transparent', color: 'var(--sarvam-text-secondary)' }}>
                                Cancel
                            </button>
                            <button className="confirm-btn discard-btn" onClick={() => {
                                setShowUnsavedPrompt(false);
                                setSettingsOpen(false);
                                setTempSettings(null);
                                navigate('/chat');
                            }} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                Discard
                            </button>
                            <button className="confirm-btn save-preferences-btn" onClick={async () => {
                                setShowUnsavedPrompt(false);
                                await handleGlobalSave();
                            }} style={{ background: 'var(--sarvam-text-main)', color: 'var(--sarvam-bg-body)' }}>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* APPS MODAL (opened via sidebar Apps button) */}
            {
                appsOpen && (
                    <div id="apps-modal" className="apps-modal show">
                        <div className="apps-modal-content">
                            <div className="settings-header">
                                <h3><i className='bx bx-grid-alt' /> Apps</h3>
                                <i className='bx bx-x' id="close-apps" onClick={() => { setAppsOpen(false); navigate('/chat'); }} />
                            </div>
                            <div className="settings-container">
                                <div className="settings-sidebar">
                                    {AGENTS.filter(a => a.id !== 'chat').map(agent => (
                                        <button
                                            key={agent.id}
                                            className={`settings-tab-btn${appsSelected === agent.id ? ' active' : ''}`}
                                            onClick={() => setAppsSelected(agent.id)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                                        >
                                            {agent.logo ? (
                                                <img src={agent.logo} alt={agent.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                                            ) : (
                                                <i className={`bx ${agent.icon}`} />
                                            )}
                                            {agent.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="settings-body">
                                   
                                    {!appsSelected && (
                                        <div style={{ padding: '20px', color: 'var(--sarvam-text-secondary)', fontSize: '16px' }}>Choose an app from the left panel</div>
                                    )}
                                    {appsSelected && (() => {
                                        const agent = AGENTS.find(a => a.id === appsSelected);
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto', padding: '20px 40px' }}>
                                            
                                                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '32px' }}>
                                                    <div style={{
                                                        width: '100px', height: '100px', borderRadius: '24px',
                                                        background: agent.color ? `${agent.color}15` : 'rgba(103, 58, 183, 0.1)',
                                                        border: `1px solid ${agent.color ? agent.color + '30' : 'rgba(103, 58, 183, 0.2)'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                        overflow: 'hidden'
                                                    }}>
                                                        {agent.logo ? (
                                                            <img src={agent.logo} alt={agent.name} style={{ width: '60%', height: '60%', objectFit: 'contain' }} />
                                                        ) : (
                                                            <i className={`bx ${agent.icon}`} style={{ fontSize: '56px', color: agent.color || 'var(--accent)' }}></i>
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                            <h2 style={{ fontSize: '28px', color: 'var(--sarvam-text-main)', margin: 0, fontWeight: 700 }}>{agent.name}</h2>
                                                            {agent.badge && (
                                                                <span style={{
                                                                    background: agent.color || 'var(--accent)', color: '#fff', fontSize: '11px',
                                                                    padding: '4px 8px', borderRadius: '12px', fontWeight: 600, letterSpacing: '0.5px'
                                                                }}>{agent.badge}</span>
                                                            )}
                                                        </div>
                                                        <p style={{ color: 'var(--sarvam-text-secondary)', fontSize: '16px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                                                            {agent.description}
                                                        </p>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            <button
                                                                onClick={() => {
                                                                    navigate(`/apps/${appsSelected}`);
                                                                    setAppsOpen(false);
                                                                }}
                                                                className="save-btn"
                                                                style={{ padding: '12px 28px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            >
                                                                <i className='bx bx-play-circle' style={{ fontSize: '20px' }}></i>
                                                                Launch App
                                                            </button>
                                                            {(appsSelected === 'googledrive' || appsSelected === 'gmail') && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (googleConnected) {
                                                                            if (window.confirm("Unlink your Google account? Agent access will be restricted.")) {
                                                                                unlinkGoogle();
                                                                                showToast("Google account unlinked safely");
                                                                            }
                                                                        } else {
                                                                            connectGoogle().then(() => {
                                                                                showToast("Connected to Google successfully!");
                                                                            }).catch(err => {
                                                                                showToast("Connection failed: " + err.message, "error");
                                                                            });
                                                                        }
                                                                    }}
                                                                    className={googleConnected ? "secondary-btn" : "save-btn"}
                                                                    style={{
                                                                        padding: '12px 28px',
                                                                        fontSize: '15px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px',
                                                                        background: googleConnected ? 'rgba(234, 67, 53, 0.1)' : '#4285f4',
                                                                        color: googleConnected ? '#ea4335' : '#fff',
                                                                        border: googleConnected ? '1px solid #ea4335' : 'none'
                                                                    }}
                                                                >
                                                                    <i className={`bx ${googleConnected ? 'bx-link-external' : 'bxl-google'}`} style={{ fontSize: '20px' }}></i>
                                                                    {googleConnected ? 'Unlink Google' : 'Connect Google'}
                                                                </button>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>

                                                <hr style={{ border: 'none', borderTop: '1px solid var(--sarvam-border)', margin: '0 0 32px 0' }} />

                                                {/* Details Section â€” driven entirely by agent.about in agents.jsx */}
                                                {agent.about && (
                                                    <div>
                                                        <h3 style={{ color: 'var(--sarvam-text-main)', fontSize: '18px', marginBottom: '16px', fontWeight: 600 }}>About this App</h3>

                                                        {/* Summary */}
                                                        <div style={{
                                                            background: 'var(--sarvam-bg-elevated)', border: '1px solid var(--sarvam-border)',
                                                            borderRadius: '16px', padding: '24px', color: 'var(--sarvam-text-secondary)',
                                                            fontSize: '15px', lineHeight: 1.7, marginBottom: '24px',
                                                        }}>
                                                            {agent.about.summary}
                                                        </div>

                                                        {/* Feature grid */}
                                                        {agent.about.features?.length > 0 && (
                                                            <>
                                                                <h3 style={{ color: 'var(--sarvam-text-main)', fontSize: '16px', marginBottom: '14px', fontWeight: 600 }}>What it can do</h3>
                                                                <div style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                                                    gap: '14px',
                                                                }}>
                                                                    {agent.about.features.map((f, i) => {
                                                                        const accentBg = agent.color ? `${agent.color}15` : 'rgba(103,58,183,0.1)';
                                                                        const accentBorder = agent.color ? `${agent.color}30` : 'rgba(103,58,183,0.2)';
                                                                        return (
                                                                            <div
                                                                                key={i}
                                                                                style={{
                                                                                    background: 'var(--sarvam-bg-elevated)',
                                                                                    border: '1px solid var(--sarvam-border)',
                                                                                    borderRadius: '14px',
                                                                                    padding: '16px',
                                                                                    display: 'flex',
                                                                                    flexDirection: 'column',
                                                                                    gap: '8px',
                                                                                    transition: 'border-color 0.2s',
                                                                                }}
                                                                                onMouseEnter={e => e.currentTarget.style.borderColor = agent.color || 'var(--accent)'}
                                                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--sarvam-border)'}
                                                                            >
                                                                                <div style={{
                                                                                    width: '36px', height: '36px', borderRadius: '10px',
                                                                                    background: accentBg, border: `1px solid ${accentBorder}`,
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                }}>
                                                                                    <i className={`bx ${f.icon}`} style={{ fontSize: '18px', color: agent.color || 'var(--accent)' }} />
                                                                                </div>
                                                                                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--sarvam-text-main)' }}>{f.title}</div>
                                                                                <div style={{ fontSize: '12.5px', color: 'var(--sarvam-text-secondary)', lineHeight: 1.55 }}>{f.desc}</div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Image modal */}
            {
                imageModal.open && (
                    <div id="image-modal" className="image-modal show" onClick={() => setImageModal({ open: false, src: '', caption: '' })}>
                        <span className="close-image-modal">Ã—</span>
                        <img className="image-modal-content" id="img-modal-preview" src={imageModal.src} alt={imageModal.caption} />
                        <div id="image-caption">{imageModal.caption}</div>
                    </div>
                )
            }
            {/* Legal Modal */}
            {legalOpen && (
                <div className="gallery-modal" onClick={(e) => { if (e.target === e.currentTarget) setLegalOpen(false); }} style={{ zIndex: 6000 }}>
                    <div className="gallery-modal-content" style={{ maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="gallery-modal-header" style={{ flexShrink: 0 }}>
                            <div className="gallery-title" style={{ display: 'flex', gap: '20px' }}>
                                <button 
                                    className={`legal-tab-btn ${legalTab === 'privacy' ? 'active' : ''}`}
                                    onClick={() => setLegalTab('privacy')}
                                    style={{ background: legalTab === 'privacy' ? 'var(--accent)' : 'transparent', border: '1px solid var(--accent)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    Privacy Policy
                                </button>
                                <button 
                                    className={`legal-tab-btn ${legalTab === 'terms' ? 'active' : ''}`}
                                    onClick={() => setLegalTab('terms')}
                                    style={{ background: legalTab === 'terms' ? 'var(--accent)' : 'transparent', border: '1px solid var(--accent)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    Terms of Service
                                </button>
                            </div>
                            <button className="gallery-close-btn" onClick={() => setLegalOpen(false)}>
                                <i className='bx bx-x' />
                            </button>
                        </div>
                        <div className="gallery-modal-body" style={{ background: 'var(--sarvam-bg-surface)', borderRadius: '0 0 12px 12px', overflowY: 'auto', padding: '20px', flex: 1 }}>
                           {legalTab === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}











