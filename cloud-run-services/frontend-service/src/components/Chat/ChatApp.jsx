import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCredits } from '../../contexts/CreditsContext';
import { streamChat, getSessions, getSession, deleteSession, generateImage, getGallery } from '../../services/api';
import { renderMarkdown, highlightAllCodeBlocks } from '../../utils/markdown';
import { formatStreamedText } from '../../utils/formatStreamedText';
import ExcelAgent from '../ExcelAgent/ExcelAgent';
import Sidebar from '../Layout/Sidebar';
import { AGENTS } from '../../config/agents';
import showToast from '../../utils/toast';

const API_BASE_URL = import.meta.env.PROD
    ? import.meta.env.VITE_BACKEND_URL
    : 'http://localhost:3000';

// AnimatedMessage no longer animates character-by-character – the
// streaming logic in handleSend now updates the message.html field using the
// same algorithm used by the vanilla frontend, so here we merely render the
// already-formatted HTML (or fall back to simple markdown). Keeping the
// component simplifies the JSX below.
const AnimatedMessage = ({ html, message, isLoading }) => {
    // if html is supplied we trust that it already contains the proper
    // formatting (tables, think blocks, etc).  Otherwise fall back to
    // renderMarkdown for backwards compatibility.
    const inner = html || renderMarkdown(message || '');
    return <span dangerouslySetInnerHTML={{ __html: inner }} />;
};

// same modifier used by original chat so animation speed matches exactly
const STREAMING_SPEED_MODIFIER = 500;

// ── Typewriter animation for header text ────────────────────────────────
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
    { id: 'sugg', icon: 'bx-code-block', title: 'Debug My Code', text: "Here's a bug I'm stuck on — can you find the issue and explain what went wrong?", accent: 'linear-gradient(135deg, #6366f1, #818cf8)' },
    { id: 'sugg2', icon: 'bx-pen', title: 'Polish My Writing', text: 'Rewrite this paragraph to sound more professional and concise, while keeping the tone friendly.', accent: 'linear-gradient(135deg, #10b981, #34d399)' },
    { id: 'sugg3', icon: 'bx-bar-chart-alt-2', title: 'Explain This Data', text: 'Analyze these numbers and tell me the key trends, outliers, and what actions I should take.', accent: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
    { id: 'sugg4', icon: 'bx-brain', title: 'Brainstorm Ideas', text: 'Give me 10 creative, unconventional ideas for my project — think outside the box.', accent: 'linear-gradient(135deg, #ec4899, #f472b6)' },
    { id: 'sugg5', icon: 'bx-book-open', title: 'Summarize This', text: 'Summarize this article or document into 5 bullet points I can read in 30 seconds.', accent: 'linear-gradient(135deg, #3b82f6, #60a5fa)' },
    { id: 'sugg6', icon: 'bx-message-square-dots', title: 'Write My Email', text: 'Draft a professional follow-up email after a meeting — firm but polite, keep it short.', accent: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' },
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
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', gemini: 'gemini-2.5-flash', title: 'Google Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Mini', gemini: 'gemini-2.5-flash-lite', title: 'Google Gemini 2.5 Mini' },
    { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2', gemini: 'moonshotai/kimi-k2-instruct-0905', title: 'Kimi K2 / Claude Sonnet 4' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', gemini: 'llama-3.3-70b-versatile', title: 'Meta Llama 3.3 70B' },
    { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B', gemini: 'qwen3-32b', title: 'Alibaba Qwen 3 32B' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', gemini: 'openai/gpt-oss-120b', title: 'OpenAI GPT-OSS 120B' },
];

const LANGUAGES = [
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', flag: '🇮🇳' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }
];

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

export default function ChatApp({ sharedSessionId }) {
    const { user, token, isGuest, logout } = useAuth();
    const { checkImageGeneration, consumeImageCredit, isPro, credits } = useCredits();
    const isReadOnly = !!sharedSessionId;

    // ── Theme state ────────────────────────────────────────────
    const [theme, setTheme] = useState(() => localStorage.getItem('app-theme-style') || 'sarvam');
    // Dark is default (no class). Light = body.white-mode. Matches original CSS.
    const [mode, setMode] = useState(() => localStorage.getItem('app-theme-mode') || 'dark');

    useEffect(() => {
        if (sharedSessionId) {
            setCurrentSessionId(sharedSessionId);
        }
    }, [sharedSessionId]);

    useEffect(() => {
        // dark = default (no class), light = body.white-mode
        if (mode === 'light') {
            document.body.classList.add('white-mode');
        } else {
            document.body.classList.remove('white-mode');
        }

        // Toggle the public stylesheet manually for the two themes
        const link = document.getElementById('sarvam-css-sheet');
        if (link) {
            link.disabled = (theme !== 'sarvam');
        }
    }, [theme, mode]);



    // ── Load Voices ────────────────────────────────────────────
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

    // ── Speech Recognition ─────────────────────────────────────
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

    // ── Sidebar open/close ─────────────────────────────────────
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // ── Sessions ───────────────────────────────────────────────
    const [sessions, setSessions] = useState([]);
    const [sessHasMore, setSessHasMore] = useState(false);
    const [sessPage, setSessPage] = useState(1);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Messages ───────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showHome, setShowHome] = useState(true);
    const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    // ── Input state ────────────────────────────────────────────
    const [appMode, setAppMode] = useState('chat');
    const [inputText, setInputText] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [pastedContent, setPastedContent] = useState('');
    const [webSearch, setWebSearch] = useState(false);
    const [selectedModel, setSelectedModel] = useState('auto');
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [showModelOptions, setShowModelOptions] = useState(false);
    const [isTemporary, setIsTemporary] = useState(false);
    const [isImageGen, setIsImageGen] = useState(false);
    const [excelAssistEnabled, setExcelAssistEnabled] = useState(true);

    // ── Settings modal ─────────────────────────────────────────
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState('general');

    // ── Apps modal ───────────────────────────────────────────
    const [appsOpen, setAppsOpen] = useState(false);
    const [appsSelected, setAppsSelected] = useState('excel'); // default to first agent except chat


    // ── Modals ─────────────────────────────────────────────────
    const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
    const [imageModal, setImageModal] = useState({ open: false, src: '', caption: '' });
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState([]); // { src, prompt, ts }

    // ── Speech Recognition ─────────────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [availableVoices, setAvailableVoices] = useState([]);
    const [settings, setSettings] = useState({
        userGender: '', userAge: '', userLanguage: '', userCulture: '',
        userDefaultModel: 'gemini-2.5-flash', userWritingStyle: '', userCreativity: '',
        userInterests: '', userCustomRules: '', userVoice: ''
    });

    // ── Message Actions State ────────────────────────────────
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editText, setEditText] = useState('');
    const [translationMenu, setTranslationMenu] = useState(null); // { messageId, x, y }
    const [translations, setTranslations] = useState({}); // { messageId: { langName, html } }
    const [speakingMessageId, setSpeakingMessageId] = useState(null);
    const [copiedMessageId, setCopiedMessageId] = useState(null);

    // ── Global Handlers for Code Blocks & Image Download ─────
    useEffect(() => {
        window.copyCodeBlock = (btn) => {
            const wrapper = btn.closest('.code-block-wrapper');
            const code = wrapper.querySelector('code').textContent;
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="bx bx-check"></i> Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('copied');
                }, 2000);
            });
        };

        window.downloadCodeBlock = (btn) => {
            const wrapper = btn.closest('.code-block-wrapper');
            const code = wrapper.querySelector('code').textContent;
            const lang = wrapper.getAttribute('data-lang') || 'txt';
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `code-snippet.${lang}`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Code snippet downloaded!');
        };

        // Download a generated image by reading its src attribute
        window.downloadGeneratedImage = (btn) => {
            const container = btn.closest('.generated-image-card');
            const img = container?.querySelector('.generated-image');
            if (!img) return;
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `chatterbox-image-${Date.now()}.png`;
            a.click();
            btn.innerHTML = '<i class="bx bx-check"></i> Downloaded!';
            setTimeout(() => { btn.innerHTML = '<i class="bx bx-download"></i> Download'; }, 2500);
        };

        // Open image in full-screen lightbox
        window.previewGeneratedImage = (img) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px)';
            const clone = document.createElement('img');
            clone.src = img.src;
            clone.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,0.7);object-fit:contain';
            overlay.appendChild(clone);
            overlay.onclick = () => document.body.removeChild(overlay);
            document.body.appendChild(overlay);
        };

        return () => {
            delete window.copyCodeBlock;
            delete window.downloadCodeBlock;
            delete window.downloadGeneratedImage;
            delete window.previewGeneratedImage;
        };
    }, []);

    // load stored preferences once on mount
    useEffect(() => {
        const saved = localStorage.getItem('chatSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSettings(parsed);
                // Apply default model from personalization settings
                if (parsed.userDefaultModel && MODELS.find(m => m.value === parsed.userDefaultModel)) {
                    setSelectedModel(parsed.userDefaultModel);
                }
            } catch { }
        }
    }, []);

    const persistSettings = () => {
        localStorage.setItem('chatSettings', JSON.stringify(settings));
    };

    const handleSaveGeneral = (e) => {
        if (e) e.preventDefault();
        persistSettings();
        showToast('Preferences saved!');
        setSettingsOpen(false);
    };

    const handleSaveAiBehavior = (e) => {
        if (e) e.preventDefault();
        persistSettings();
        // Apply default model immediately if it was changed
        if (settings.userDefaultModel && MODELS.find(m => m.value === settings.userDefaultModel)) {
            setSelectedModel(settings.userDefaultModel);
        }
        showToast('AI behavior saved!');
        setSettingsOpen(false);
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

    // ── Refs ───────────────────────────────────────────────────
    const recognitionRef = useRef(null);
    const chatboxRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const pastedTextRef = useRef(null);
    const ignoreNextSessionLoadRef = useRef(false);

    // ── Scroll lock ref: true when user has scrolled up ────────
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
    }, []); // mount once — chatboxRef is stable

    // ── Auto resize textarea ───────────────────────────────────
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    }, [inputText]);

    // ── After messages update: only run syntax highlight, NO auto-scroll
    // Scrolling is handled directly in the streaming RAF loop with userScrolledUpRef guard
    useEffect(() => {
        const box = chatboxRef.current;
        if (!box) return;
        highlightAllCodeBlocks(box);
    }, [messages]);

    // ── Load gallery images from DB on mount ──────────────────
    useEffect(() => {
        if (!user || isGuest || !token) return;
        getGallery(user.email, token)
            .then(data => {
                if (data?.images?.length) {
                    setGalleryImages(
                        data.images.map(img => ({
                            src: `data:image/png;base64,${img.imageBase64}`,
                            prompt: img.prompt,
                            ts: new Date(img.createdAt).getTime()
                        }))
                    );
                }
            })
            .catch(console.error);
    }, [user, token, isGuest]);

    // ── Load sessions ──────────────────────────────────────────
    const loadSessions = useCallback(async (page = 1, append = false) => {
        if (!user || isGuest || isReadOnly) return;
        setSessionsLoading(true);
        try {
            const data = await getSessions(user.email, token, page);
            if (append) setSessions(p => [...p, ...(data.sessions || [])]);
            else setSessions(data.sessions || []);
            setSessHasMore(data.hasNextPage || false);
            setSessPage(page);
        } catch (e) { console.error(e); }
        finally { setSessionsLoading(false); }
    }, [user, token, isGuest, isReadOnly]);

    useEffect(() => { loadSessions(1); }, [loadSessions]);

    // ── Load session messages ──────────────────────────────────
    const loadSessionMessages = useCallback(async (id) => {
        setIsLoading(true);
        setMessages([]);
        setShowHome(false);
        try {
            let data;
            if (isReadOnly) {
                data = await import('../../services/api').then(m => m.getPublicSession(id));
            } else {
                data = await getSession(user.email, id, token);
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

                        html = `<div class="generated-image-card"><div class="gen-image-wrap"><img class="generated-image" src="${imgSrc}" alt="${promptText.replace(/"/g, '&quot;')}" onclick="window.previewGeneratedImage(this)" title="Click to preview full size" /><div class="gen-image-overlay"><button class="gen-img-btn gen-preview-btn" onclick="window.previewGeneratedImage(this.closest('.generated-image-card').querySelector('.generated-image'))"><i class="bx bx-fullscreen"></i> Preview</button><button class="gen-img-btn gen-download-btn" onclick="window.downloadGeneratedImage(this)"><i class="bx bx-download"></i> Download</button></div></div><p class="gen-image-caption"><i class="bx bx-image-alt"></i> Here’s your image for <em>"${shortPrompt}"</em> — click to preview or download above.</p></div>`;
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
                        html,
                        isHtml: role === 'outgoing' && html !== rawText,
                        loading: false
                    };
                }));
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, [user, token, isReadOnly]);

    useEffect(() => {
        if (currentSessionId) {
            if (ignoreNextSessionLoadRef.current) {
                ignoreNextSessionLoadRef.current = false;
            } else {
                loadSessionMessages(currentSessionId);
            }
        }
        else { setMessages([]); setShowHome(true); }
    }, [currentSessionId, loadSessionMessages]);

    // ── Send message ───────────────────────────────────────────
    const handleSend = useCallback(async (overrideText) => {
        const text = overrideText ?? inputText.trim();
        if (!text && !selectedFile && !pastedContent) return;
        if (isLoading) return;

        // ── Feature gate: image generation credits ──────────────
        if (isImageGen && !checkImageGeneration()) {
            // checkImageGeneration() opens the upgrade modal automatically
            return;
        }

        setShowHome(false);
        setInputText('');
        setSelectedFile(null);
        setPastedContent('');
        setShowActionsMenu(false);
        // Re-engage auto-scroll for the new response
        userScrolledUpRef.current = false;
        setShowScrollBtn(false);

        const userMsgId = 'u-' + Date.now();
        const aiMsgId = 'a-' + Date.now();

        let finalMessageContent = text;
        if (pastedContent) {
            finalMessageContent += (finalMessageContent ? "\n\n" : "") + `[Pasted Context]:\n${pastedContent}`;
        }

        let msgDisplayHtml = text;
        let hasHtml = false;

        if (pastedContent) {
            msgDisplayHtml += (msgDisplayHtml ? "<br/><br/>" : "") + `<div class="pasted-snippet-preview" style="background: rgba(255,255,255,0.05); border-left: 3px solid var(--accent); padding: 8px 12px; border-radius: 4px; font-size: 0.9em; overflow-x: auto;"><div style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-bottom: 4px; text-transform: uppercase;">Attached Snippet</div>${pastedContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
            hasHtml = true;
        }

        if (selectedFile) {
            if (selectedFile.type.startsWith('image/')) {
                const objectUrl = URL.createObjectURL(selectedFile);
                msgDisplayHtml = `<div class="user-attached-image" style="margin-bottom: 8px;"><img src="${objectUrl}" alt="attached" style="max-width: 200px; border-radius: 8px;" /></div>` + msgDisplayHtml;
            } else {
                msgDisplayHtml = `<div class="user-attached-file" style="background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 8px;"><i class='bx bx-file' style="font-size: 1.2em;"></i> ${selectedFile.name}</div><div style="margin-bottom: 4px;"></div>` + msgDisplayHtml;
            }
            hasHtml = true;
        }

        const userMsgObj = hasHtml ? { id: userMsgId, role: 'outgoing', content: msgDisplayHtml, isHtml: true, rawContent: finalMessageContent } : { id: userMsgId, role: 'outgoing', content: text, rawContent: finalMessageContent };

        // store both raw text and html for the AI message; html will be built
        // progressively by the formatter so the UI can render tables/code/think
        // blocks correctly while streaming.
        setMessages(p => [...p, userMsgObj]);
        setMessages(p => [...p, { id: aiMsgId, role: 'incoming', content: '', html: '', loading: true, imageGen: isImageGen }]);
        setIsLoading(true);

        // If user wants to generate image, bypass streamChat and hit the generate-image endpoint natively
        if (isImageGen) {
            setIsImageGen(false);
            try {
                const data = await generateImage(
                    text,
                    user?.email || 'guest@example.com',
                    currentSessionId,
                    isGuest ? 'guest' : token
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
        if (selectedFile) formData.append('image', selectedFile);

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
                    let html = formatStreamedText(displayedText);

                    let count = 0;
                    html = html.replace(/<details class="think-block-details">/g, (match) => {
                        const isOpen = openIndices.has(count++);
                        return isOpen ? '<details class="think-block-details" open>' : match;
                    });

                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, html, loading: false } : m
                    ));
                    // Scroll only if user hasn't scrolled up
                    const box = chatboxRef.current;
                    if (box && !userScrolledUpRef.current) {
                        box.scrollTop = box.scrollHeight;
                    }
                    // run syntax highlighting on the updated HTML
                    highlightAllCodeBlocks(chatboxRef.current);
                    requestAnimationFrame(animateText);
                } else if (!isStreaming) {
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, html, loading: false } : m
                    ));
                    highlightAllCodeBlocks(chatboxRef.current);
                    let html = formatStreamedText(fullText);
                    let count = 0;
                    html = html.replace(/<details class="think-block-details">/g, (match) => {
                        const isOpen = openIndices.has(count++);
                        return isOpen ? '<details class="think-block-details" open>' : match;
                    });
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, html, loading: false } : m
                    ));
                } else {
                    requestAnimationFrame(animateText);
                }
            };
            requestAnimationFrame(animateText);

            await streamChat({
                formData,
                token: isGuest ? 'guest' : token,
                onChunk: (chunk) => {
                    // accumulate the raw text; animation loop will pick it up
                    fullText += chunk;
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText, loading: false } : m
                    ));
                },
                onSessionId: (sid) => {
                    if (!currentSessionId) {
                        ignoreNextSessionLoadRef.current = true;
                        setCurrentSessionId(sid);
                        loadSessions(1);
                    }
                },
                onEnd: () => {
                    isStreaming = false;
                    setIsLoading(false);
                    // Final update to ensure content is properly stored
                    const html = formatStreamedText(fullText);
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText, html, loading: false } : m
                    ));
                },
                onError: (err) => {
                    isStreaming = false;
                    setIsLoading(false);
                    fullText = `⚠️ Error: ${err} `;
                    setMessages(p => p.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText, html: fullText, loading: false } : m
                    ));
                },
            });
        } catch (e) {
            console.error('Chat error:', e);
            setIsLoading(false);
            setMessages(p => p.map(m =>
                m.id === aiMsgId ? { ...m, html: `❌ ${e.message} `, loading: false } : m
            ));
        }
    }, [inputText, selectedFile, pastedContent, isLoading, selectedModel, webSearch, isTemporary, isImageGen, currentSessionId, user, token, isGuest, loadSessions]);

    // ── Helper Actions ────────────────────────────────────────
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
            await import('../../services/api').then(m => m.toggleSessionShare(user.email, currentSessionId, token));
            const shareUrl = `${window.location.origin}/?share=${currentSessionId}`;
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

        // Remove all messages after this one
        setMessages(p => {
            const newMsgs = p.slice(0, idx + 1);
            newMsgs[idx].content = editText;
            return newMsgs;
        });

        setEditingMessageId(null);
        // Trigger a new AI response for the updated text
        handleSend(editText);
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

    const startNewChat = () => {
        setAppMode('chat');
        setCurrentSessionId(null);
        setMessages([]);
        setShowHome(true);
        setInputText('');
        setSelectedFile(null);
        setSidebarOpen(false);
    };

    const handleDeleteSession = async (id) => {
        try {
            await deleteSession(user.email, id, token);
            setSessions(p => p.filter(s => s._id !== id));
            if (currentSessionId === id) startNewChat();
        } catch (e) { console.error(e); }
        setDeleteModal({ open: false, id: null });
    };

    const filteredSessions = sessions.filter(s =>
        s.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getModelGeminiValue = () => (MODELS.find(m => m.value === selectedModel) || MODELS[0]).gemini;

    const profileInitial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();

    return (
        <>
            {/* ══════════════════════════════════════════
          SIDEBAR — exact same classes as original
      ══════════════════════════════════════════ */}
            <Sidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                user={user}
                logout={logout}
                isGuest={isGuest}
                appMode={appMode}
                setAppMode={setAppMode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                startNewChat={startNewChat}
                filteredSessions={filteredSessions}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
                setDeleteModal={setDeleteModal}
                sessHasMore={sessHasMore}
                sessionsLoading={sessionsLoading}
                loadSessions={loadSessions}
                sessPage={sessPage}
                setSettingsOpen={setSettingsOpen}
                setAppsOpen={setAppsOpen}
                galleryCount={galleryImages.length}
                onOpenGallery={() => setGalleryOpen(true)}
            />

            {/* ══════════════════════════════════════════
          MAIN CHATBOT SECTION
      ══════════════════════════════════════════ */}
            <section className="show-chatbot" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minWidth: 0 }}>
                {appMode !== 'chat' && AGENTS.find(a => a.id === appMode)?.component ? (
                    (() => {
                        const agent = AGENTS.find(a => a.id === appMode);
                        const AgentComp = agent.component;
                        return (
                            <div className="chatbot" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <header>
                                    <div className="left-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: 15 }}>
                                        <i className='bx bx-menu' id="btn1" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: 'pointer' }} />
                                    </div>
                                    <div className="center-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <i className={`bx ${agent.icon}`} style={{ color: agent.color || 'var(--accent)' }} />
                                            <TypewriterText text={`Treevit — ${agent.name}`} speed={38} />
                                        </h2>
                                    </div>
                                    <div className="right-heder-bar" style={{ paddingRight: 15 }}>
                                        <button
                                            onClick={() => setAppMode('chat')}
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
                                    />
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="chatbot">
                        {/* ── Header ── */}
                        <header>
                            <div className="left-header" style={{ display: 'flex', alignItems: 'center', paddingLeft: 15 }}>
                                {!isReadOnly && <i className='bx bx-menu' id="btn1" onClick={() => setSidebarOpen(!sidebarOpen)} />}
                            </div>
                            <div className="center-header">
                                <h2><TypewriterText text="Treevit" speed={270} /></h2>
                            </div>
                            <div className="right-heder-bar">
                                {!isReadOnly && (
                                    <>
                                        <button
                                            id="temp-chat-btn"
                                            className={`temp-chat-btn${isTemporary ? ' active' : ''}`}
                                            title={isTemporary ? 'Temporary chat ON — messages won\'t be saved. Click to disable.' : 'Enable temporary chat — messages won\'t be saved'}
                                            onClick={() => {
                                                const turningOn = !isTemporary;
                                                setIsTemporary(turningOn);
                                                if (turningOn) {
                                                    // Only start fresh if there's an active chat
                                                    if (messages.length > 0 || currentSessionId) {
                                                        startNewChat();
                                                    }
                                                    showToast('Temporary chat enabled — messages won\'t be saved');
                                                } else {
                                                    showToast('Temporary chat disabled — messages will be saved');
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
                                    </>
                                )}
                                <div>
                                </div>
                            </div>
                        </header>

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
                                                /* ── Image generation loading animation ── */
                                                <div className="premium-image-loader">
                                                    <div className="img-gen-shimmer" />
                                                    <div className="img-gen-loader-text">
                                                        <i className="bx bx-image-alt img-gen-icon" />
                                                        <span>Sketching…</span>
                                                    </div>
                                                    <div className="img-gen-bar-wrap">
                                                        <div className="img-gen-bar" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="chat-spinner" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center' }}>
                                                    <img
                                                        src="/assets/Star-icon.png"
                                                        className={`chatbot-img spinner`}
                                                        alt="Loading"
                                                        style={{ height: 32, width: 32, borderRadius: 6, background: 'none' }}
                                                    />
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
                                                        <div className="translation-content" dangerouslySetInnerHTML={{ __html: translations[msg.id].html }}></div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {!msg.loading && msg.content && !msg.content.includes("❌ Image Gen") && (
                                            <div className="chat-actions" style={{ display: 'flex' }}>
                                                <button
                                                    className={`action-btn copy-btn ${copiedMessageId === msg.id ? 'copied' : ''}`}
                                                    title="Copy"
                                                    onClick={() => handleCopy(msg.id, msg.content)}
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
                                    <div key={msg.id} className="chat outgoing" id={msg.id}>
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
                                            <>
                                                {msg.isHtml ? (
                                                    <div className="chat-content" dangerouslySetInnerHTML={{ __html: msg.content }}></div>
                                                ) : (
                                                    <p className="chat-content">{msg.content}</p>
                                                )}
                                                <div className="user-chat-actions" style={{ display: 'flex' }}>
                                                    <button
                                                        className={`action-btn copy-btn ${copiedMessageId === msg.id ? 'copied' : ''}`}
                                                        title="Copy text"
                                                        onClick={() => handleCopy(msg.id, msg.content)}
                                                    >
                                                        <i className={`bx ${copiedMessageId === msg.id ? 'bx-check' : 'bx-copy'}`}></i>
                                                    </button>
                                                    {!isReadOnly && (
                                                        <button className="action-btn edit-btn" title="Edit message" onClick={() => handleStartEdit(msg.id, msg.rawContent || msg.content)}>
                                                            <i className="bx bx-pencil"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
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

                        {/* ── Scroll-to-bottom FAB ── */}
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

                        {/* ── Chat Input ── */}
                        {!isReadOnly && (
                            <div className="chat-input-container">
                                <div className="chat-input" id="chat-input">
                                    <div className="input-wrapper">
                                        <div className="previews-container" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {/* File preview */}
                                            {selectedFile && (
                                                <div id="file-preview" className="file-preview" style={{ display: 'flex' }}>
                                                    {selectedFile.type.startsWith('image/') && (
                                                        <img src={URL.createObjectURL(selectedFile)} alt="preview" className="preview-thumbnail" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                                                    )}
                                                    <div className="file-info-col">
                                                        <div className="file-preview-text" id="file-preview-text" style={{ paddingLeft: selectedFile.type.startsWith('image/') ? 10 : 0 }}>{selectedFile.name}</div>
                                                        <div className="file-bottom-row" style={{ paddingLeft: selectedFile.type.startsWith('image/') ? 10 : 0 }}>
                                                            <span className="file-preview-badge" id="file-preview-badge">FILE</span>
                                                            <span id="file-name">{selectedFile.name}</span>
                                                        </div>
                                                    </div>
                                                    <i className="bx bx-x cancel-file" title="Remove file" onClick={() => setSelectedFile(null)} />
                                                </div>
                                            )}
                                            {/* Pasted Text Preview */}
                                            {pastedContent && (
                                                <div id="pasted-text-preview" className="file-preview" style={{ display: 'flex' }}>
                                                    <div className="file-info-col">
                                                        <div className="file-preview-text" id="pasted-preview-text">{pastedContent.length > 50 ? pastedContent.substring(0, 50) + '...' : pastedContent}</div>
                                                        <div className="file-bottom-row">
                                                            <span className="file-preview-badge" id="pasted-preview-badge">PASTED</span>
                                                            <span id="pasted-file-name">Text Snippet</span>
                                                        </div>
                                                    </div>
                                                    <i className="bx bx-x cancel-file" id="cancel-pasted" title="Remove pasted text" onClick={() => setPastedContent('')} />
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
                                        />
                                    </div>

                                    <div className="chat-input-toolbar">
                                        {/* Left tools */}
                                        <div className="toolbar-left" style={{ position: 'relative' }}>
                                            <div
                                                className="icon-btn"
                                                id="plus-btn"
                                                title="More Options"
                                                onClick={e => { e.stopPropagation(); setShowActionsMenu(p => !p); }}
                                            >
                                                <i className='bx bx-plus' />
                                            </div>

                                            {/* Actions menu */}
                                            <div className={`input-actions-menu ${showActionsMenu ? 'show' : ''}`} id="input-actions-menu">
                                                <div className="menu-item">
                                                    <label htmlFor="file-upload" className="menu-icon-btn" title="Upload File">
                                                        <i className="bx bx-paperclip" />
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
                                                                // Auto-detect Excel file if Excel Assist is enabled
                                                                const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
                                                                if (excelAssistEnabled && isExcel) {
                                                                    setAppMode('excel');
                                                                }
                                                            }
                                                            setShowActionsMenu(false);
                                                        }}
                                                    />
                                                </div>
                                                <div className="menu-item">
                                                    <div
                                                        className={`menu-icon-btn${webSearch ? ' active' : ''}`}
                                                        id="web-search"
                                                        title="Google Web Search"
                                                        onClick={() => { setWebSearch(p => !p); setShowActionsMenu(false); }}
                                                    >
                                                        <i className='bx bxl-google' />
                                                        <span>Google Search</span>
                                                    </div>
                                                </div>

                                                <div className="menu-item">
                                                    <div
                                                        className={`menu-icon-btn${isImageGen ? ' active' : ''}`}
                                                        id="generate-image-btn"
                                                        title="Generate Image"
                                                        onClick={() => { setIsImageGen(p => !p); setShowActionsMenu(false); }}
                                                    >
                                                        <i className='bx bx-image-add' />
                                                        <span>Generate Image</span>
                                                    </div>
                                                </div>

                                                <div className="menu-item divider" style={{ height: '1px', background: 'var(--sarvam-border)', margin: '4px 0' }} />


                                            </div>
                                        </div>

                                        {/* Right tools */}
                                        <div className="toolbar-right" style={{ position: 'relative' }}>
                                            {/* Model selector */}
                                            <div className={`model-select-wrapper ${showModelOptions ? 'open' : ''}`} id="model-wrapper">
                                                <div
                                                    className="model-select-trigger"
                                                    id="model-trigger"
                                                    onClick={() => {

                                                        setShowModelOptions(p => !p);
                                                    }}
                                                >
                                                    <span id="model-display">{MODELS.find(m => m.value === selectedModel)?.label || 'Auto'}</span>
                                                    <i className='bx bx-chevron-down' />
                                                </div>
                                                <div className="model-options" id="model-options">
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
                                                        >
                                                            {m.label}
                                                        </div>
                                                    ))}
                                                </div>

                                            </div>

                                            {/* Mic button */}
                                            <div className="mic-btn" id="mic-btn" title="Start speaking" onClick={toggleListening}>
                                                <i className={`bx ${isListening ? 'bx-loader bx-spin' : 'bxs-microphone-big'}`} />
                                            </div>

                                            {/* Send button */}
                                            <span>
                                                <i
                                                    className='bx bxs-arrow-up-circle'
                                                    id="send-button"
                                                    onClick={() => handleSend()}
                                                    style={{ cursor: isLoading ? 'default' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

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
            </section >

            {/* ══════════════════════════════════════════
          DELETE CONFIRM MODAL
      ══════════════════════════════════════════ */}
            {
                deleteModal.open && (
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
                )
            }

            {/* ══════════════════════════════════════════
          GALLERY MODAL
      ══════════════════════════════════════════ */}
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
                                            <p className="gallery-item-prompt">{img.prompt.length > 60 ? img.prompt.slice(0, 60) + '…' : img.prompt}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════
          SETTINGS MODAL — exact original structure
      ══════════════════════════════════════════ */}
            {
                settingsOpen && (
                    <div id="settings-modal" className="settings-modal show">
                        <div className="settings-modal-content">
                            <div className="settings-header">
                                <h3><i className='bx bx-cog' /> Settings</h3>
                                <i className='bx bx-x' id="close-settings" onClick={() => setSettingsOpen(false)} />
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
                                                        value={settings.userGender}
                                                        onChange={v => setSettings(s => ({ ...s, userGender: v }))}
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
                                                        value={settings.userAge}
                                                        onChange={v => setSettings(s => ({ ...s, userAge: v }))}
                                                        placeholder="Select Age Group"
                                                        options={[
                                                            { value: '', label: 'Select Age Group' },
                                                            { value: 'child', label: 'Child (≤12)' },
                                                            { value: 'teen', label: 'Teen / Gen-Z (13-22)' },
                                                            { value: 'adult', label: 'Adult (23-45)' },
                                                            { value: 'older', label: 'Older Adult (46+)' },
                                                        ]}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-language">Mother Tongue / Primary Language</label>
                                                    <input type="text" id="user-language" placeholder="e.g., Tamil, Spanish, Hindi" />
                                                </div>

                                                <div className="form-group">
                                                    <label htmlFor="user-culture">Cultural Background</label>
                                                    <input type="text" id="user-culture" placeholder="e.g., South Indian, Western, Japanese" />
                                                </div>

                                                <div className="form-group">
                                                    <label>Theme Style</label>
                                                    <div className="theme-picker" id="theme-picker">
                                                        {['classic', 'sarvam'].map(t => (
                                                            <div
                                                                key={t}
                                                                className={`theme-card${theme === t ? ' selected' : ''}`}
                                                                data-theme={t}
                                                                onClick={() => {
                                                                    setTheme(t);
                                                                    localStorage.setItem('app-theme-style', t);
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
                                                                    <span className="theme-desc">{t === 'classic' ? 'Original bold theme' : 'Modern Sarvam style'}</span>
                                                                </div>
                                                                <div className="theme-card-check"><i className='bx bx-check' /></div>
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
                                                                className={`mode-seg-btn${mode === m ? ' selected' : ''}`}
                                                                type="button"
                                                                data-mode={m}
                                                                onClick={() => {
                                                                    setMode(m);
                                                                    localStorage.setItem('app-theme-mode', m);
                                                                }}
                                                            >
                                                                <i className={`bx ${m === 'dark' ? 'bxs-moon' : 'bxs-sun'}`} />
                                                                <span>{m === 'dark' ? 'Dark' : 'Light'}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="settings-actions">
                                                    <button type="submit" className="save-btn">Save Preferences</button>
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
                                                        value={settings.userDefaultModel}
                                                        onChange={v => setSettings(s => ({ ...s, userDefaultModel: v }))}
                                                        placeholder="Select Model"
                                                        options={MODELS}
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label>AI Writing Style</label>
                                                    <CustomSelect
                                                        id="user-writing-style"
                                                        value={settings.userWritingStyle}
                                                        onChange={v => setSettings(s => ({ ...s, userWritingStyle: v }))}
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
                                                        value={settings.userCreativity}
                                                        onChange={v => setSettings(s => ({ ...s, userCreativity: v }))}
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
                                                        value={settings.userInterests}
                                                        onChange={e => setSettings(s => ({ ...s, userInterests: e.target.value }))}
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

            {/* APPS MODAL (opened via sidebar Apps button) */}
            {
                appsOpen && (
                    <div id="apps-modal" className="apps-modal show">
                        <div className="apps-modal-content">
                            <div className="settings-header">
                                <h3><i className='bx bx-grid-alt' /> Apps</h3>
                                <i className='bx bx-x' id="close-apps" onClick={() => setAppsOpen(false)} />
                            </div>
                            <div className="settings-container">
                                <div className="settings-sidebar">
                                    {AGENTS.filter(a => a.id !== 'chat').map(agent => (
                                        <button
                                            key={agent.id}
                                            className={`settings-tab-btn${appsSelected === agent.id ? ' active' : ''}`}
                                            onClick={() => setAppsSelected(agent.id)}
                                        >
                                            <i className={`bx ${agent.icon}`} />
                                            {agent.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="settings-body">
                                    {/* show hint while selecting or loading */}
                                    {!appsSelected && (
                                        <div style={{ padding: '20px', color: 'var(--sarvam-text-secondary)', fontSize: '16px' }}>Choose an app from the left panel</div>
                                    )}
                                    {appsSelected && (() => {
                                        const agent = AGENTS.find(a => a.id === appsSelected);
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px', margin: '0 auto', padding: '20px 40px' }}>
                                                {/* Header Profile Section */}
                                                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '32px' }}>
                                                    <div style={{
                                                        width: '100px', height: '100px', borderRadius: '24px',
                                                        background: agent.color ? `${agent.color}15` : 'rgba(103, 58, 183, 0.1)',
                                                        border: `1px solid ${agent.color ? agent.color + '30' : 'rgba(103, 58, 183, 0.2)'}`,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                    }}>
                                                        <i className={`bx ${agent.icon}`} style={{ fontSize: '56px', color: agent.color || 'var(--accent)' }}></i>
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
                                                                    setAppMode(appsSelected);
                                                                    setAppsOpen(false);
                                                                }}
                                                                className="save-btn"
                                                                style={{ padding: '12px 28px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            >
                                                                <i className='bx bx-play-circle' style={{ fontSize: '20px' }}></i>
                                                                Launch App
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <hr style={{ border: 'none', borderTop: '1px solid var(--sarvam-border)', margin: '0 0 32px 0' }} />

                                                {/* Details Section */}
                                                <div>
                                                    <h3 style={{ color: 'var(--sarvam-text-main)', fontSize: '18px', marginBottom: '16px', fontWeight: 600 }}>About this App</h3>
                                                    <div style={{
                                                        background: 'var(--sarvam-bg-elevated)', border: '1px solid var(--sarvam-border)',
                                                        borderRadius: '16px', padding: '24px', color: 'var(--sarvam-text-secondary)',
                                                        fontSize: '15px', lineHeight: 1.7
                                                    }}>
                                                        {agent.id === 'excel' ? (
                                                            <>
                                                                <p style={{ marginBottom: '16px' }}>
                                                                    The Excel Agent is a powerful spreadsheet assistant powered by AI. It can analyze your CSV and XLSX files, write complex formulas, and format your data instantly.
                                                                </p>
                                                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}><i className='bx bx-check-circle' style={{ color: agent.color || 'var(--accent)', marginTop: '4px' }}></i> <strong>Smart Formulas:</strong> Tell it what you need in plain English.</li>
                                                                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}><i className='bx bx-check-circle' style={{ color: agent.color || 'var(--accent)', marginTop: '4px' }}></i> <strong>Data Analysis:</strong> Instantly summarize large datasets and spot trends.</li>
                                                                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}><i className='bx bx-check-circle' style={{ color: agent.color || 'var(--accent)', marginTop: '4px' }}></i> <strong>Interactive Canvas:</strong> Edits to the spreadsheet happen in real-time.</li>
                                                                </ul>
                                                            </>
                                                        ) : (
                                                            <p>Access specialized AI capabilities built right into the platform.</p>
                                                        )}
                                                    </div>
                                                </div>
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
                        <span className="close-image-modal">×</span>
                        <img className="image-modal-content" id="img-modal-preview" src={imageModal.src} alt={imageModal.caption} />
                        <div id="image-caption">{imageModal.caption}</div>
                    </div>
                )
            }
        </>
    );
}
