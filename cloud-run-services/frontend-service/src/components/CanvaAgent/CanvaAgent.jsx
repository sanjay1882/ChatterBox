import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { canvaAgentStream } from '../../services/api';
import html2canvas from 'html2canvas';
import MessageBubble from '../Chat/MessageBubble';
import { highlightAllCodeBlocks } from '../../utils/markdown';


// ── Constants ─────────────────────────────────────────────────────────────────
const SLIDE_W = 960;
const SLIDE_H = 540;
const GRID_SIZE = 10;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

const QUICK_PROMPTS = [
    'Add a title slide',
    'Make a gradient background',
    'Add centered heading',
    'Insert a purple shape',
    'Make text bold & large',
    'Add a subtitle text',
    'Change background color',
    'Add a footer text',
];

const TEMPLATES = [
    { id: 'blank',    label: 'Blank',      icon: 'bx-file-blank', bg: '#1a1a2e' },
    { id: 'dark',     label: 'Dark Mode',  icon: 'bx-moon',       bg: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
    { id: 'gradient', label: 'Gradient',   icon: 'bx-palette',    bg: 'linear-gradient(135deg,#7c3aed,#a855f7,#ec4899)' },
    { id: 'minimal',  label: 'Minimal',    icon: 'bx-layout',     bg: '#ffffff' },
    { id: 'business', label: 'Business',   icon: 'bx-briefcase',  bg: 'linear-gradient(135deg,#1e293b,#334155)' },
    { id: 'creative', label: 'Creative',   icon: 'bx-brush',      bg: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
];

const FONT_FAMILIES = [
    { label: 'Sans',    value: 'Inter, sans-serif' },
    { label: 'Serif',   value: 'Georgia, serif' },
    { label: 'Mono',    value: 'monospace' },
    { label: 'Display', value: '"Playfair Display", serif' },
];

const WELCOME_MESSAGE = {
    role: 'ai',
    content: `Welcome to **Canva Agent** ✨\n\nI can help you design beautiful slides. Try:\n- **"Add a title with your text"**\n- **"Make the background purple gradient"**\n- **"Add a rounded rectangle shape"**\n\nOr pick a template below to get started!`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

function createSlide(bg = '#1e1b31') {
    return { id: uid(), background: bg, elements: [] };
}
function createTextElement(x = 80, y = 80, text = 'New Text', fontSize = 32, color = '#ffffff', bold = false) {
    return {
        id: uid(), type: 'text',
        x, y, w: 400, h: 60,
        text, fontSize, color,
        bold, italic: false, align: 'left',
        fontFamily: 'Inter, sans-serif',
        zIndex: 1,
    };
}
function createShapeElement(x = 100, y = 120, w = 200, h = 120, fill = '#7c3aed', radius = 12) {
    return { id: uid(), type: 'shape', x, y, w, h, fill, radius, zIndex: 1 };
}
function createImageElement(x = 80, y = 80, w = 300, h = 200, src) {
    return { id: uid(), type: 'image', x, y, w, h, src, zIndex: 1 };
}

function applyPatch(slide, patch) {
    const s = { ...slide };
    if (patch.background) s.background = patch.background;
    if (Array.isArray(patch.addElements)) {
        s.elements = [...s.elements, ...patch.addElements.map(el => ({ ...el, id: el.id || uid(), zIndex: el.zIndex || 1 }))];
    }
    if (Array.isArray(patch.removeElements)) {
        const ids = new Set(patch.removeElements);
        s.elements = s.elements.filter(e => !ids.has(e.id));
    }
    if (Array.isArray(patch.updateElements)) {
        const map = Object.fromEntries(patch.updateElements.map(u => [u.id, u]));
        s.elements = s.elements.map(e => map[e.id] ? { ...e, ...map[e.id] } : e);
    }
    return s;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CanvaAgent() {
    const { user, token, getFreshToken } = useAuth();

    // ── Slides state ──
    const [slides, setSlides]           = useState([]);
    const [activeSlide, setActiveSlide] = useState(0);

    // ── Selection & editing ──
    const [selectedId, setSelectedId]   = useState(null);
    const [editingId, setEditingId]     = useState(null);
    const [multiSelect, setMultiSelect] = useState([]);  // NEW: multi-select ids

    // ── Dragging ──
    const dragging = useRef(null);
    const resizing = useRef(null);

    // ── Properties bar ──
    const [fontSize, setFontSize]       = useState(32);
    const [textColor, setTextColor]     = useState('#ffffff');
    const [fillColor, setFillColor]     = useState('#7c3aed');
    const [isBold, setIsBold]           = useState(false);
    const [isItalic, setIsItalic]       = useState(false);
    const [fontFamily, setFontFamily]   = useState('Inter, sans-serif'); // NEW

    // ── Undo / Redo ──  (NEW)
    const undoStack = useRef([]);
    const redoStack = useRef([]);

    // ── Copy / Paste ──  (NEW)
    const clipboard = useRef(null);

    // ── Zoom ──  (NEW)
    const [zoom, setZoom]               = useState(1.0);

    // ── Snap to grid ──  (NEW)
    const [snapEnabled, setSnapEnabled] = useState(true);

    // ── Layer panel ──  (NEW)
    const [showLayers, setShowLayers]   = useState(false);

    // ── Chat state ──
    const [messages, setMessages]       = useState([WELCOME_MESSAGE]);
    const [input, setInput]             = useState('');
    const [isThinking, setIsThinking]   = useState(false);
    const [sessionId, setSessionId]     = useState(null);

    // ── UI state ──
    const [chatWidth, setChatWidth]     = useState(340);
    const [isResizingPanel, setIsResizingPanel] = useState(false);
    const [isMobile, setIsMobile]       = useState(window.innerWidth <= 768);
    const [mobileTab, setMobileTab]     = useState('chat');

    const msgsBottom   = useRef(null);
    const slideRef     = useRef(null);
    const editorRef    = useRef(null);
    const fileRef      = useRef(null);

    // ── Responsive ──
    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    // ── Scroll chat ──
    useEffect(() => {
        msgsBottom.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    // ── Highlight code blocks ──
    useEffect(() => {
        const c = document.querySelector('.canva-messages');
        if (c) highlightAllCodeBlocks(c);
    }, [messages, isThinking]);

    // ── Sync properties bar ──
    useEffect(() => {
        if (!slides[activeSlide]) return;
        const el = slides[activeSlide].elements.find(e => e.id === selectedId);
        if (!el) return;
        if (el.type === 'text') {
            setFontSize(el.fontSize ?? 32);
            setTextColor(el.color ?? '#ffffff');
            setIsBold(el.bold ?? false);
            setIsItalic(el.italic ?? false);
            setFontFamily(el.fontFamily ?? 'Inter, sans-serif');
        }
        if (el.type === 'shape') setFillColor(el.fill ?? '#7c3aed');
    }, [selectedId, activeSlide, slides]);

    // ── Panel resizer ──
    const startPanelResize = useCallback((e) => { e.preventDefault(); setIsResizingPanel(true); }, []);
    const stopPanelResize  = useCallback(() => setIsResizingPanel(false), []);
    const doPanelResize    = useCallback((e) => {
        if (!isResizingPanel) return;
        const w = e.clientX;
        if (w > 240 && w < 600) setChatWidth(w);
    }, [isResizingPanel]);

    useEffect(() => {
        if (isResizingPanel) {
            window.addEventListener('mousemove', doPanelResize);
            window.addEventListener('mouseup', stopPanelResize);
        } else {
            window.removeEventListener('mousemove', doPanelResize);
            window.removeEventListener('mouseup', stopPanelResize);
        }
        return () => {
            window.removeEventListener('mousemove', doPanelResize);
            window.removeEventListener('mouseup', stopPanelResize);
        };
    }, [isResizingPanel, doPanelResize, stopPanelResize]);

    // ── Ctrl+Wheel Zoom ──  (NEW)
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)).toFixed(2))));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // ── Slide helpers ──
    const currentSlide = slides[activeSlide];

    const updateSlide = (updater) =>
        setSlides(prev => prev.map((s, i) => i === activeSlide ? updater(s) : s));

    const updateElement = (id, patch) =>
        updateSlide(s => ({ ...s, elements: s.elements.map(e => e.id === id ? { ...e, ...patch } : e) }));

    // ── Undo / Redo helpers ──  (NEW)
    const pushHistory = useCallback(() => {
        undoStack.current = [...undoStack.current, JSON.parse(JSON.stringify(slides))];
        if (undoStack.current.length > 50) undoStack.current.shift();
        redoStack.current = [];
    }, [slides]);

    const undo = useCallback(() => {
        if (!undoStack.current.length) return;
        redoStack.current = [JSON.parse(JSON.stringify(slides)), ...redoStack.current];
        setSlides(undoStack.current.pop());
        setSelectedId(null);
    }, [slides]);

    const redo = useCallback(() => {
        if (!redoStack.current.length) return;
        undoStack.current = [...undoStack.current, JSON.parse(JSON.stringify(slides))];
        setSlides(redoStack.current.shift());
        setSelectedId(null);
    }, [slides]);

    // ── Snap helper ──  (NEW)
    const snap = (v) => snapEnabled ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;

    // ── Slide CRUD ──
    const addSlide = (bg = '#1e1b31') => {
        pushHistory();
        const s = createSlide(bg);
        setSlides(prev => [...prev, s]);
        setActiveSlide(slides.length);
        setSelectedId(null);
    };

    const deleteSlide = (idx) => {
        if (slides.length <= 1) return;
        pushHistory();
        setSlides(prev => prev.filter((_, i) => i !== idx));
        setActiveSlide(Math.max(0, idx - 1));
    };

    // NEW: duplicate slide
    const duplicateSlide = (idx) => {
        pushHistory();
        const copy = { ...JSON.parse(JSON.stringify(slides[idx])), id: uid() };
        setSlides(prev => { const n = [...prev]; n.splice(idx + 1, 0, copy); return n; });
        setActiveSlide(idx + 1);
    };

    const addTextElement = () => {
        pushHistory();
        const el = createTextElement(80, 80 + (currentSlide?.elements.length ?? 0) * 70, 'Double-click to edit');
        updateSlide(s => ({ ...s, elements: [...s.elements, el] }));
        setSelectedId(el.id);
    };

    const addShapeElement = () => {
        pushHistory();
        const el = createShapeElement(120, 120, 200, 120, fillColor);
        updateSlide(s => ({ ...s, elements: [...s.elements, el] }));
        setSelectedId(el.id);
    };

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        pushHistory();
        updateSlide(s => ({ ...s, elements: s.elements.filter(e => e.id !== selectedId) }));
        setSelectedId(null);
    }, [selectedId, slides]); // eslint-disable-line

    // ── Copy / Paste ──  (NEW)
    const copySelected = useCallback(() => {
        if (!selectedId || !currentSlide) return;
        const el = currentSlide.elements.find(e => e.id === selectedId);
        if (el) clipboard.current = JSON.parse(JSON.stringify(el));
    }, [selectedId, currentSlide]);

    const pasteElement = useCallback(() => {
        if (!clipboard.current) return;
        pushHistory();
        const cloned = { ...JSON.parse(JSON.stringify(clipboard.current)), id: uid(), x: clipboard.current.x + 20, y: clipboard.current.y + 20 };
        updateSlide(s => ({ ...s, elements: [...s.elements, cloned] }));
        setSelectedId(cloned.id);
    }, [slides]); // eslint-disable-line

    const duplicateSelected = useCallback(() => {
        if (!selectedId || !currentSlide) return;
        const el = currentSlide.elements.find(e => e.id === selectedId);
        if (!el) return;
        pushHistory();
        const cloned = { ...JSON.parse(JSON.stringify(el)), id: uid(), x: el.x + 20, y: el.y + 20 };
        updateSlide(s => ({ ...s, elements: [...s.elements, cloned] }));
        setSelectedId(cloned.id);
    }, [selectedId, currentSlide, slides]); // eslint-disable-line

    // ── Alignment helpers ──  (NEW)
    const alignElement = useCallback((direction) => {
        if (!selectedId || !currentSlide) return;
        const el = currentSlide.elements.find(e => e.id === selectedId);
        if (!el) return;
        pushHistory();
        const patches = {
            'left':     { x: 0 },
            'center-h': { x: (SLIDE_W - el.w) / 2 },
            'right':    { x: SLIDE_W - el.w },
            'top':      { y: 0 },
            'center-v': { y: (SLIDE_H - el.h) / 2 },
            'bottom':   { y: SLIDE_H - el.h },
        };
        if (patches[direction]) updateElement(selectedId, patches[direction]);
    }, [selectedId, currentSlide, slides]); // eslint-disable-line

    // ── Layer order ──  (NEW)
    const changeLayer = useCallback((direction) => {
        if (!selectedId || !currentSlide) return;
        pushHistory();
        updateSlide(s => {
            const els = [...s.elements];
            const idx = els.findIndex(e => e.id === selectedId);
            if (direction === 'up' && idx < els.length - 1) {
                [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]];
            } else if (direction === 'down' && idx > 0) {
                [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]];
            } else if (direction === 'front') {
                const [el] = els.splice(idx, 1);
                els.push(el);
            } else if (direction === 'back') {
                const [el] = els.splice(idx, 1);
                els.unshift(el);
            }
            return { ...s, elements: els };
        });
    }, [selectedId, currentSlide, slides]); // eslint-disable-line

    // ── Element Drag ──
    const onElementMouseDown = (e, el) => {
        if (editingId === el.id) return;
        e.stopPropagation();
        e.preventDefault();
        setSelectedId(el.id);
        const rect = slideRef.current.getBoundingClientRect();
        const scale = (SLIDE_W / rect.width) / zoom;
        dragging.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, scale };
    };

    const onResizeHandleMouseDown = (e, el, corner = 'se') => {
        e.stopPropagation();
        e.preventDefault();
        const rect = slideRef.current.getBoundingClientRect();
        const scale = (SLIDE_W / rect.width) / zoom;
        resizing.current = { id: el.id, startX: e.clientX, startY: e.clientY, origW: el.w, origH: el.h, origX: el.x, origY: el.y, scale, corner };
    };

    useEffect(() => {
        const onMove = (e) => {
            if (dragging.current) {
                const { id, startX, startY, origX, origY, scale } = dragging.current;
                updateElement(id, {
                    x: snap(Math.max(0, origX + (e.clientX - startX) * scale)),
                    y: snap(Math.max(0, origY + (e.clientY - startY) * scale)),
                });
            }
            if (resizing.current) {
                const { id, startX, startY, origW, origH, origX, origY, scale, corner } = resizing.current;
                const dw = (e.clientX - startX) * scale;
                const dh = (e.clientY - startY) * scale;
                if (corner === 'se') {
                    updateElement(id, { w: Math.max(40, origW + dw), h: Math.max(20, origH + dh) });
                } else if (corner === 'nw') {
                    updateElement(id, { x: origX + dw, y: origY + dh, w: Math.max(40, origW - dw), h: Math.max(20, origH - dh) });
                } else if (corner === 'ne') {
                    updateElement(id, { y: origY + dh, w: Math.max(40, origW + dw), h: Math.max(20, origH - dh) });
                } else if (corner === 'sw') {
                    updateElement(id, { x: origX + dw, w: Math.max(40, origW - dw), h: Math.max(20, origH + dh) });
                }
            }
        };
        const onUp = () => { dragging.current = null; resizing.current = null; };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [slides, activeSlide, zoom, snapEnabled]); // eslint-disable-line

    // ── Image upload ──
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        pushHistory();
        const url = URL.createObjectURL(file);
        const el = createImageElement(80, 80, 300, 200, url);
        updateSlide(s => ({ ...s, elements: [...s.elements, el] }));
        setSelectedId(el.id);
        e.target.value = null;
    };

    // ── Properties ──
    const applyFontSize   = (v) => { setFontSize(v); if (selectedId) updateElement(selectedId, { fontSize: Number(v) }); };
    const applyTextColor  = (v) => { setTextColor(v); if (selectedId) updateElement(selectedId, { color: v }); };
    const applyFillColor  = (v) => { setFillColor(v); if (selectedId) updateElement(selectedId, { fill: v }); };
    const applyBold       = () => { const n = !isBold; setIsBold(n); if (selectedId) updateElement(selectedId, { bold: n }); };
    const applyItalic     = () => { const n = !isItalic; setIsItalic(n); if (selectedId) updateElement(selectedId, { italic: n }); };
    const applyFontFamily = (v) => { setFontFamily(v); if (selectedId) updateElement(selectedId, { fontFamily: v }); }; // NEW

    // ── PNG Export ──  (NEW — requires html2canvas: npm install html2canvas)
    const exportSlide = async () => {
        if (!slideRef.current) return;
        const prev = selectedId;
        setSelectedId(null);
        await new Promise(r => setTimeout(r, 80));
        try {
            const canvas = await html2canvas(slideRef.current, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: null, 
                logging: false 
            });
            const link = document.createElement('a');
            link.download = `slide-${activeSlide + 1}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch {
            alert('Install html2canvas: npm install html2canvas');
        } finally {
            setSelectedId(prev);
        }
    };

    // ── Template start ──
    const startTemplate = (t) => {
        const s = createSlide(t.bg);
        if (t.id !== 'blank' && t.id !== 'minimal') {
            const title = createTextElement(SLIDE_W / 2 - 300, SLIDE_H / 2 - 50, t.label + ' Presentation', 48, '#ffffff', true);
            title.align = 'center'; title.w = 600;
            s.elements.push(title);
            const sub = createTextElement(SLIDE_W / 2 - 200, SLIDE_H / 2 + 30, 'Your subtitle here', 22, 'rgba(255,255,255,0.7)');
            sub.align = 'center'; sub.w = 400;
            s.elements.push(sub);
        }
        setSlides([s]);
        setActiveSlide(0);
        setSelectedId(null);
    };

    // ── Keyboard shortcuts ──  (expanded)
    useEffect(() => {
        const h = (e) => {
            const mod = e.ctrlKey || e.metaKey;

            // Undo / Redo
            if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); return; }
            if ((mod && e.key === 'y') || (mod && e.shiftKey && e.key === 'z')) { e.preventDefault(); redo(); return; }

            // Copy / Paste / Duplicate
            if (mod && e.key === 'c' && selectedId && !editingId) { copySelected(); return; }
            if (mod && e.key === 'v' && !editingId) { pasteElement(); return; }
            if (mod && e.key === 'd' && selectedId && !editingId) { e.preventDefault(); duplicateSelected(); return; }

            // Delete
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) { deleteSelected(); return; }

            // Escape deselect
            if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); return; }

            // Arrow nudge (1px, or 10px with Shift)
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selectedId && !editingId) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                const el = currentSlide?.elements.find(el => el.id === selectedId);
                if (!el) return;
                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
                updateElement(selectedId, { x: el.x + dx, y: el.y + dy });
                return;
            }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [selectedId, editingId, slides, undo, redo, copySelected, pasteElement, duplicateSelected, deleteSelected]); // eslint-disable-line

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
        let accumulated = '';
        const slideContext = currentSlide
            ? JSON.stringify({
                slideIndex: activeSlide + 1,
                totalSlides: slides.length,
                background: currentSlide.background,
                elements: currentSlide.elements.map(({ id, type, x, y, w, h, text, fontSize, color, bold, italic, fill, radius, align }) =>
                    ({ id, type, x, y, w, h, text, fontSize, color, bold, italic, fill, radius, align })
                ),
            }) : null;
        try {
            const activeToken = await getFreshToken();
            await canvaAgentStream({
                message: txt, slideContext,
                token: activeToken || 'guest',
                email: user?.email || 'guest@canva.local',
                sessionId,
                onSessionId: (id) => setSessionId(id),
                onChunk: (chunk) => {
                    accumulated += chunk;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: accumulated } : m));
                },
                onData: (data) => {
                    if (data.fullMessage) {
                        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: data.fullMessage } : m));
                    }
                    if (data.patch && currentSlide) {
                        pushHistory();
                        setSlides(prev => prev.map((s, i) => i === activeSlide ? applyPatch(s, data.patch) : s));
                    }
                    if (!data.patch) tryInlineJsonPatch(accumulated);
                },
            });
        } catch (err) {
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: `⚠️ Error: ${err.message || 'Something went wrong'}` } : m));
        } finally {
            setIsThinking(false);
            tryInlineJsonPatch(accumulated);
        }
    };

    const tryInlineJsonPatch = (text) => {
        if (!currentSlide) return;
        const match = text.match(/```json\s*([\s\S]*?)```/);
        if (!match) return;
        try {
            const patch = JSON.parse(match[1]);
            if (patch && (patch.background || patch.addElements || patch.updateElements || patch.removeElements)) {
                pushHistory();
                setSlides(prev => prev.map((s, i) => i === activeSlide ? applyPatch(s, patch) : s));
            }
        } catch { /* ignore */ }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // ── Derived ──
    const hasDesign = slides.length > 0;
    const selectedEl = currentSlide?.elements.find(e => e.id === selectedId) ?? null;

    const chatStyle   = isMobile ? { display: mobileTab === 'chat'   ? 'flex' : 'none', width: '100%', minWidth: '100%' } : { width: chatWidth, minWidth: chatWidth };
    const canvasStyle = isMobile ? { display: mobileTab === 'canvas' ? 'flex' : 'none', width: '100%', minWidth: '100%' } : {};

    const changeZoom = (delta) => setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={`canva-agent ${isResizingPanel ? 'is-resizing' : ''} ${isMobile ? 'is-mobile' : ''}`}>

            {/* ── Mobile Tabs ── */}
            {isMobile && (
                <div className="canva-mobile-tabs">
                    <button className={`canva-mobile-tab ${mobileTab === 'chat' ? 'active' : ''}`} onClick={() => setMobileTab('chat')}>
                        <i className='bx bx-message-rounded-dots' /> Chat
                    </button>
                    <button className={`canva-mobile-tab ${mobileTab === 'canvas' ? 'active' : ''}`} onClick={() => setMobileTab('canvas')}>
                        <i className='bx bx-palette' /> Designer
                    </button>
                </div>
            )}

            {/* ── Chat Panel ── */}
            <div className="canva-chat-panel" style={chatStyle}>
                <div className="canva-chat-header">
                    <div className="canva-chat-header-icon"><i className='bx bxs-paint' /></div>
                    <div><h3>Canva Agent</h3><p>AI-powered design editor</p></div>
                </div>
                <div className="canva-messages">
                    {messages.map((msg, i) => (
                        <div key={msg.id || i} className="canva-message-wrapper">
                            <MessageBubble
                                msg={msg}
                                userPhoto={user?.photoURL}
                                userInitial={user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                                isStreaming={isThinking && i === messages.length - 1}
                            />
                        </div>
                    ))}
                    <div ref={msgsBottom} />
                </div>
                <div className="canva-chat-input-area">
                    <div className="canva-quick-prompts">
                        {QUICK_PROMPTS.map((p, i) => (
                            <span key={i} className="canva-chip" onClick={() => sendMessage(p)}>{p}</span>
                        ))}
                    </div>
                    <div className="canva-chat-box">
                        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Tell AI what to design…" rows={2} />
                        <button className="canva-send-btn" onClick={() => sendMessage()} disabled={!input.trim() || isThinking}>
                            {isThinking ? <i className='bx bx-loader-alt spin' /> : <i className='bx bxs-send' />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Resizer ── */}
            {!isMobile && (
                <div className={`canva-resizer ${isResizingPanel ? 'active' : ''}`} onMouseDown={startPanelResize}>
                    <div className="resizer-handle" />
                </div>
            )}

            {/* ── Canvas ── */}
            <div className="canva-canvas" style={canvasStyle}>

                {/* ── Toolbar ── */}
                <div className="canva-toolbar">
                    <div className="canva-toolbar-left">
                        {/* Undo / Redo */}
                        <button className="canva-toolbar-btn ghost" onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)">
                            <i className='bx bx-undo' />
                        </button>
                        <button className="canva-toolbar-btn ghost" onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Y)">
                            <i className='bx bx-redo' />
                        </button>
                        <div className="canva-toolbar-sep" />

                        {hasDesign && (
                            <>
                                <button className="canva-toolbar-btn primary" onClick={addTextElement} title="Add text"><i className='bx bx-text' /> Text</button>
                                <button className="canva-toolbar-btn primary" onClick={addShapeElement} title="Add shape"><i className='bx bx-shape-square' /> Shape</button>
                                <label className="canva-toolbar-btn primary" style={{ cursor: 'pointer' }} title="Upload image">
                                    <i className='bx bx-image-add' /> Image
                                    <input type="file" accept="image/*" hidden ref={fileRef} onChange={handleImageUpload} />
                                </label>

                                {selectedId && (
                                    <>
                                        <div className="canva-toolbar-sep" />
                                        {/* Copy / Paste / Duplicate */}
                                        <button className="canva-toolbar-btn ghost" onClick={copySelected} title="Copy (Ctrl+C)"><i className='bx bx-copy' /></button>
                                        {clipboard.current && (
                                            <button className="canva-toolbar-btn ghost" onClick={pasteElement} title="Paste (Ctrl+V)"><i className='bx bx-paste' /></button>
                                        )}
                                        <button className="canva-toolbar-btn ghost" onClick={duplicateSelected} title="Duplicate (Ctrl+D)"><i className='bx bx-duplicate' /></button>
                                        <div className="canva-toolbar-sep" />
                                        {/* Layer order */}
                                        <button className="canva-toolbar-btn ghost" onClick={() => changeLayer('front')} title="Bring to front"><i className='bx bx-bring-to-front' /></button>
                                        <button className="canva-toolbar-btn ghost" onClick={() => changeLayer('back')}  title="Send to back"><i className='bx bx-send-to-back' /></button>
                                        <div className="canva-toolbar-sep" />
                                        <button className="canva-toolbar-btn ghost" onClick={deleteSelected} title="Delete (Del)"><i className='bx bx-trash' style={{ color: '#f87171' }} /></button>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    <div className="canva-toolbar-right">
                        {/* Zoom controls */}
                        {hasDesign && (
                            <>
                                <button className="canva-toolbar-btn ghost" onClick={() => changeZoom(-ZOOM_STEP)} title="Zoom out"><i className='bx bx-zoom-out' /></button>
                                <span className="canva-zoom-label">{Math.round(zoom * 100)}%</span>
                                <button className="canva-toolbar-btn ghost" onClick={() => changeZoom(ZOOM_STEP)} title="Zoom in"><i className='bx bx-zoom-in' /></button>
                                <button className="canva-toolbar-btn ghost" onClick={() => setZoom(1)} title="Reset zoom"><i className='bx bx-reset' /></button>
                                <div className="canva-toolbar-sep" />
                                {/* Snap toggle */}
                                <button className={`canva-toolbar-btn ghost ${snapEnabled ? 'snap-active' : ''}`} onClick={() => setSnapEnabled(v => !v)} title={`Snap to grid (${snapEnabled ? 'ON' : 'OFF'})`}>
                                    <i className='bx bx-grid-alt' />
                                </button>
                                {/* Layer panel toggle */}
                                <button className={`canva-toolbar-btn ghost ${showLayers ? 'snap-active' : ''}`} onClick={() => setShowLayers(v => !v)} title="Layers panel">
                                    <i className='bx bx-layer' />
                                </button>
                                <div className="canva-toolbar-sep" />
                                <button className="canva-toolbar-btn ghost" onClick={exportSlide} title="Export PNG"><i className='bx bx-download' /></button>
                                <div className="canva-toolbar-sep" />
                            </>
                        )}
                        <button className="canva-toolbar-btn accent" onClick={() => addSlide()}>
                            <i className='bx bx-plus' /> New Slide
                        </button>
                    </div>
                </div>

                {/* ── Properties Bar ── */}
                {hasDesign && selectedEl && (
                    <div className="canva-properties-bar">
                        {selectedEl.type === 'text' && (
                            <>
                                {/* Font family */}
                                <select className="canva-prop-select" value={fontFamily} onChange={e => applyFontFamily(e.target.value)} title="Font family">
                                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                                <div className="canva-prop-sep" />
                                <div className="canva-prop-group">
                                    <button className={`canva-prop-btn ${isBold ? 'active' : ''}`} onClick={applyBold}><b>B</b></button>
                                    <button className={`canva-prop-btn ${isItalic ? 'active' : ''}`} onClick={applyItalic}><i>I</i></button>
                                </div>
                                <div className="canva-prop-sep" />
                                <input type="number" className="canva-font-size-input" value={fontSize} min={8} max={200} onChange={e => applyFontSize(e.target.value)} title="Font size" />
                                <div className="canva-prop-sep" />
                                {/* Text alignment */}
                                <div className="canva-prop-group">
                                    {['left','center','right'].map(a => (
                                        <button key={a} className={`canva-prop-btn ${selectedEl.align === a ? 'active' : ''}`} onClick={() => updateElement(selectedId, { align: a })} title={`Align ${a}`}>
                                            <i className={`bx bx-align-${a}`} />
                                        </button>
                                    ))}
                                </div>
                                <div className="canva-prop-sep" />
                                <div className="canva-prop-group" title="Text color">
                                    <div className="canva-color-picker-wrap">
                                        <div className="canva-color-preview" style={{ background: textColor }} />
                                        <input type="color" value={textColor} onChange={e => applyTextColor(e.target.value)} />
                                    </div>
                                </div>
                            </>
                        )}
                        {selectedEl.type === 'shape' && (
                            <>
                                <div className="canva-prop-group" title="Fill color">
                                    <div className="canva-color-picker-wrap">
                                        <div className="canva-color-preview" style={{ background: fillColor }} />
                                        <input type="color" value={fillColor} onChange={e => applyFillColor(e.target.value)} />
                                    </div>
                                </div>
                                <div className="canva-prop-sep" />
                                <label className="canva-prop-label">Radius</label>
                                <input type="number" className="canva-font-size-input" value={selectedEl.radius ?? 12} min={0} max={100}
                                    onChange={e => updateElement(selectedId, { radius: Number(e.target.value) })} title="Border radius" />
                            </>
                        )}
                        <div className="canva-prop-sep" />
                        {/* Alignment buttons */}
                        <div className="canva-prop-group">
                            <button className="canva-prop-btn" onClick={() => alignElement('left')}     title="Align left"><i className='bx bx-align-left' /></button>
                            <button className="canva-prop-btn" onClick={() => alignElement('center-h')} title="Center horiz."><i className='bx bx-align-middle' /></button>
                            <button className="canva-prop-btn" onClick={() => alignElement('right')}    title="Align right"><i className='bx bx-align-right' /></button>
                            <button className="canva-prop-btn" onClick={() => alignElement('top')}      title="Align top"><i className='bx bx-align-top' /></button>
                            <button className="canva-prop-btn" onClick={() => alignElement('center-v')} title="Center vert."><i className='bx bx-align-justify' /></button>
                            <button className="canva-prop-btn" onClick={() => alignElement('bottom')}   title="Align bottom"><i className='bx bx-align-bottom' /></button>
                        </div>
                        <div className="canva-prop-sep" />
                        <span className="canva-coord-label">
                            x:{Math.round(selectedEl.x)} y:{Math.round(selectedEl.y)} · {Math.round(selectedEl.w)}×{Math.round(selectedEl.h)}
                        </span>
                    </div>
                )}

                {/* ── Main area ── */}
                {!hasDesign ? (
                    <div className="canva-empty-zone" onClick={() => setSelectedId(null)}>
                        <div className="canva-empty-icon"><i className='bx bxs-paint' /></div>
                        <h3>Start your design</h3>
                        <p>Choose a template below, or just ask the AI on the left to create something for you.</p>
                        <div className="canva-template-grid">
                            {TEMPLATES.map(t => (
                                <div key={t.id} className="canva-template-card" style={{ background: t.bg }} onClick={() => startTemplate(t)}>
                                    <i className={`bx ${t.icon}`} style={{ color: t.id === 'minimal' ? '#7c3aed' : '#fff' }} />
                                    <span style={{ color: t.id === 'minimal' ? '#334155' : '#fff' }}>{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

                        {/* ── Slide Editor ── */}
                        <div className="canva-editor-area" ref={editorRef}>
                            <div className="canva-page-wrapper" onClick={() => setSelectedId(null)}>
                                <div
                                    ref={slideRef}
                                    className="canva-slide"
                                    style={{
                                        width: '100%',
                                        maxWidth: Math.min(SLIDE_W, window.innerWidth - (isMobile ? 0 : chatWidth + 170)),
                                        aspectRatio: `${SLIDE_W}/${SLIDE_H}`,
                                        background: currentSlide?.background || '#1e1b31',
                                        position: 'relative',
                                        transform: `scale(${zoom})`,
                                        transformOrigin: 'top center',
                                        transition: 'transform 0.1s ease',
                                    }}
                                    onClick={e => { e.stopPropagation(); setSelectedId(null); }}
                                >
                                    {/* Snap grid overlay */}
                                    {snapEnabled && selectedId && (
                                        <div className="canva-snap-grid" style={{
                                            backgroundSize: `${(GRID_SIZE / SLIDE_W) * 100}% ${(GRID_SIZE / SLIDE_H) * 100}%`
                                        }} />
                                    )}
                                    {currentSlide?.elements.map(el => (
                                        <RenderElement
                                            key={el.id}
                                            el={el}
                                            selected={selectedId === el.id}
                                            editing={editingId === el.id}
                                            slideW={SLIDE_W}
                                            slideH={SLIDE_H}
                                            onMouseDown={onElementMouseDown}
                                            onResizeMouseDown={onResizeHandleMouseDown}
                                            onDoubleClick={(el) => { setEditingId(el.id); setSelectedId(el.id); }}
                                            onBlurText={(el, text) => { updateElement(el.id, { text }); setEditingId(null); }}
                                            onSelect={(id) => setSelectedId(id)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Status bar */}
                            <div className="canva-status-bar">
                                <div className="stat"><i className='bx bx-slideshow' /> Slide <strong>{activeSlide + 1}</strong> / {slides.length}</div>
                                {selectedEl && <div className="stat ai-stat"><i className='bx bx-select-multiple' /> {selectedEl.type} selected</div>}
                                {snapEnabled && <div className="stat"><i className='bx bx-grid-alt' /> Snap {GRID_SIZE}px</div>}
                                <div className="stat" style={{ marginLeft: 'auto' }}>
                                    <i className='bx bx-expand-alt' /> {SLIDE_W}×{SLIDE_H} · {Math.round(zoom * 100)}%
                                </div>
                            </div>
                        </div>

                        {/* ── Layers Panel ──  (NEW) */}
                        {!isMobile && showLayers && currentSlide && (
                            <div className="canva-layers-panel">
                                <div className="canva-slides-label">
                                    <i className='bx bx-layer' /> Layers
                                </div>
                                {[...currentSlide.elements].reverse().map((el, i) => (
                                    <div
                                        key={el.id}
                                        className={`canva-layer-item ${selectedId === el.id ? 'active' : ''}`}
                                        onClick={() => setSelectedId(el.id)}
                                    >
                                        <i className={`bx ${el.type === 'text' ? 'bx-text' : el.type === 'shape' ? 'bx-shape-square' : 'bx-image'}`} />
                                        <span className="canva-layer-label">
                                            {el.type === 'text' ? (el.text?.slice(0, 18) || 'Text') : el.type === 'shape' ? 'Shape' : 'Image'}
                                        </span>
                                        <div className="canva-layer-actions">
                                            <button onClick={e => { e.stopPropagation(); setSelectedId(el.id); changeLayer('up'); }} title="Move up"><i className='bx bx-chevron-up' /></button>
                                            <button onClick={e => { e.stopPropagation(); setSelectedId(el.id); changeLayer('down'); }} title="Move down"><i className='bx bx-chevron-down' /></button>
                                        </div>
                                    </div>
                                ))}
                                {currentSlide.elements.length === 0 && (
                                    <div style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No elements yet</div>
                                )}
                            </div>
                        )}

                        {/* ── Slides Panel ── */}
                        {!isMobile && !showLayers && (
                            <div className="canva-slides-panel">
                                <div className="canva-slides-label">Slides</div>
                                {slides.map((s, i) => (
                                    <SlideThumb
                                        key={s.id}
                                        slide={s}
                                        index={i}
                                        active={i === activeSlide}
                                        onClick={() => { setActiveSlide(i); setSelectedId(null); }}
                                        onDelete={() => deleteSlide(i)}
                                        onDuplicate={() => duplicateSlide(i)}
                                        canDelete={slides.length > 1}
                                    />
                                ))}
                                <button className="canva-add-slide-btn" onClick={() => addSlide()}>
                                    <i className='bx bx-plus' /> Slide
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Element Renderer ──────────────────────────────────────────────────────────
function RenderElement({ el, selected, editing, slideW, slideH, onMouseDown, onResizeMouseDown, onDoubleClick, onBlurText, onSelect }) {
    const textRef = useRef(null);

    useLayoutEffect(() => {
        if (editing && textRef.current) {
            textRef.current.focus();
            const range = document.createRange();
            range.selectNodeContents(textRef.current);
            range.collapse(false);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
        }
    }, [editing]);

    const style = {
        left:   `${(el.x / slideW) * 100}%`,
        top:    `${(el.y / slideH) * 100}%`,
        width:  `${(el.w / slideW) * 100}%`,
        height: `${(el.h / slideH) * 100}%`,
    };

    if (el.type === 'text') {
        return (
            <div
                className={`canva-element text-el ${selected ? 'selected' : ''}`}
                style={{
                    ...style,
                    fontSize: `${(el.fontSize / slideH) * 100}vh`,
                    color: el.color || '#ffffff',
                    fontWeight: el.bold ? '700' : '400',
                    fontStyle: el.italic ? 'italic' : 'normal',
                    textAlign: el.align || 'left',
                    fontFamily: el.fontFamily || 'Inter, sans-serif',
                    lineHeight: 1.3,
                    zIndex: selected ? 10 : 1,
                    cursor: editing ? 'text' : 'move',
                }}
                onMouseDown={e => { if (!editing) onMouseDown(e, el); }}
                onDoubleClick={e => { e.stopPropagation(); onDoubleClick(el); }}
                onClick={e => { e.stopPropagation(); onSelect(el.id); }}
            >
                <div
                    ref={textRef}
                    contentEditable={editing}
                    suppressContentEditableWarning
                    style={{ outline: 'none', width: '100%' }}
                    onBlur={editing ? (e => onBlurText(el, e.currentTarget.textContent)) : undefined}
                    onKeyDown={e => { if (e.key === 'Escape') onBlurText(el, e.currentTarget.textContent); }}
                >
                    {el.text}
                </div>
                {selected && !editing && (
                    <>
                        <div className="canva-resize-handle se" onMouseDown={e => onResizeMouseDown(e, el, 'se')} />
                        <div className="canva-resize-handle nw" onMouseDown={e => onResizeMouseDown(e, el, 'nw')} />
                        <div className="canva-resize-handle ne" onMouseDown={e => onResizeMouseDown(e, el, 'ne')} />
                        <div className="canva-resize-handle sw" onMouseDown={e => onResizeMouseDown(e, el, 'sw')} />
                    </>
                )}
            </div>
        );
    }

    if (el.type === 'shape') {
        return (
            <div
                className={`canva-element shape-el ${selected ? 'selected' : ''}`}
                style={{ ...style, background: el.fill || '#7c3aed', borderRadius: el.radius ?? 8, zIndex: selected ? 10 : 1 }}
                onMouseDown={e => onMouseDown(e, el)}
                onClick={e => { e.stopPropagation(); onSelect(el.id); }}
            >
                {selected && (
                    <>
                        <div className="canva-resize-handle se" onMouseDown={e => onResizeMouseDown(e, el, 'se')} />
                        <div className="canva-resize-handle nw" onMouseDown={e => onResizeMouseDown(e, el, 'nw')} />
                        <div className="canva-resize-handle ne" onMouseDown={e => onResizeMouseDown(e, el, 'ne')} />
                        <div className="canva-resize-handle sw" onMouseDown={e => onResizeMouseDown(e, el, 'sw')} />
                    </>
                )}
            </div>
        );
    }

    if (el.type === 'image') {
        return (
            <div
                className={`canva-element image-el ${selected ? 'selected' : ''}`}
                style={{ ...style, zIndex: selected ? 10 : 1 }}
                onMouseDown={e => onMouseDown(e, el)}
                onClick={e => { e.stopPropagation(); onSelect(el.id); }}
            >
                <img src={el.src} alt="" draggable={false} />
                {selected && (
                    <>
                        <div className="canva-resize-handle se" onMouseDown={e => onResizeMouseDown(e, el, 'se')} />
                        <div className="canva-resize-handle nw" onMouseDown={e => onResizeMouseDown(e, el, 'nw')} />
                        <div className="canva-resize-handle ne" onMouseDown={e => onResizeMouseDown(e, el, 'ne')} />
                        <div className="canva-resize-handle sw" onMouseDown={e => onResizeMouseDown(e, el, 'sw')} />
                    </>
                )}
            </div>
        );
    }
    return null;
}

// ── Slide Thumbnail ───────────────────────────────────────────────────────────
function SlideThumb({ slide, index, active, onClick, onDelete, onDuplicate, canDelete }) {
    return (
        <div className={`canva-slide-thumb ${active ? 'active' : ''}`} onClick={onClick}>
            <div style={{ width: '100%', height: '100%', background: slide.background || '#1e1b31', position: 'relative', overflow: 'hidden' }}>
                {slide.elements.map(el => {
                    const s = {
                        position: 'absolute',
                        left:   `${(el.x / 960) * 100}%`,
                        top:    `${(el.y / 540) * 100}%`,
                        width:  `${(el.w / 960) * 100}%`,
                        height: `${(el.h / 540) * 100}%`,
                    };
                    if (el.type === 'text')  return <div key={el.id} style={{ ...s, background: `${el.color || '#fff'}55`, borderRadius: 2 }} />;
                    if (el.type === 'shape') return <div key={el.id} style={{ ...s, background: el.fill || '#7c3aed', borderRadius: el.radius ? `${el.radius * 0.1}px` : 2 }} />;
                    if (el.type === 'image') return <div key={el.id} style={{ ...s, background: 'rgba(168,85,247,0.3)', borderRadius: 2 }} />;
                    return null;
                })}
            </div>
            <div className="canva-slide-num">{index + 1}</div>
            <div className="canva-thumb-actions">
                <button className="canva-thumb-btn" onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Duplicate slide">
                    <i className='bx bx-copy' />
                </button>
                {canDelete && (
                    <button className="canva-thumb-btn danger" onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete slide">
                        <i className='bx bx-trash' />
                    </button>
                )}
            </div>
        </div>
    );
}