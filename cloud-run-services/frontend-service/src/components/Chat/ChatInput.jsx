import { useState, useRef, useEffect } from 'react';
import './Chat.css';

const MODELS = [
    { value: 'gemini-2.5-flash', label: 'Auto', desc: 'Fast & Smart' },
    { value: 'gemini-2.5-flash-lite', label: 'Fast', desc: 'Ultra-fast' },
    { value: 'gemini-2.0-flash-thinking-exp', label: 'Deep', desc: 'Deep Thinking' },
];

export default function ChatInput({ onSend, isLoading, onStop }) {
    const [text, setText] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [webSearch, setWebSearch] = useState(false);
    const [file, setFile] = useState(null);
    const [showActions, setShowActions] = useState(false);
    const [showModels, setShowModels] = useState(false);
    const textareaRef = useRef(null);
    const fileRef = useRef(null);

    const currentModel = MODELS.find(m => m.value === model) || MODELS[0];

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }, [text]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const submit = () => {
        if (!text.trim() && !file) return;
        onSend({ text: text.trim(), file, model, webSearch });
        setText('');
        setFile(null);
        setShowActions(false);
    };

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) setFile(f);
        setShowActions(false);
        e.target.value = '';
    };

    const fileIcon = (f) => {
        if (!f) return 'bx-file';
        if (f.type.startsWith('image')) return 'bx-image';
        if (f.type.includes('pdf')) return 'bx-file-pdf';
        return 'bx-file';
    };

    return (
        <div className="input-area">
            <div className="input-box" style={{ position: 'relative' }}>
                {/* File chip */}
                {file && (
                    <div className="file-chip">
                        <i className={`bx ${fileIcon(file)} file-chip-icon`} />
                        <span className="file-chip-name">{file.name}</span>
                        <button className="file-chip-remove" onClick={() => setFile(null)}>
                            <i className='bx bx-x' />
                        </button>
                    </div>
                )}

                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    rows={1}
                />

                <div className="input-toolbar">
                    <div className="input-toolbar-left" style={{ position: 'relative' }}>
                        <button
                            className={`toolbar-icon-btn ${showActions ? 'active' : ''}`}
                            onClick={() => setShowActions(p => !p)}
                            title="More options"
                        >
                            <i className='bx bx-plus' />
                        </button>

                        <button
                            className={`toolbar-icon-btn ${webSearch ? 'active' : ''}`}
                            onClick={() => setWebSearch(p => !p)}
                            title={webSearch ? 'Web search ON' : 'Web search OFF'}
                        >
                            <i className='bx bxl-google' />
                        </button>

                        {/* Actions popup */}
                        {showActions && (
                            <div className="actions-popup">
                                <label className="actions-popup-item">
                                    <i className='bx bx-paperclip' />
                                    Upload File
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*,.pdf,.txt,.js,.py,.java,.c,.cpp,.html,.css,.json,.md,.csv"
                                        hidden
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="input-toolbar-right" style={{ position: 'relative' }}>
                        {/* Model selector */}
                        <div className="model-pill" onClick={() => setShowModels(p => !p)}>
                            <i className='bx bx-chip' style={{ fontSize: 14 }} />
                            {currentModel.label}
                            <i className='bx bx-chevron-up' style={{ fontSize: 13 }} />
                        </div>

                        {showModels && (
                            <div className="model-dropdown">
                                {MODELS.map(m => (
                                    <div
                                        key={m.value}
                                        className={`model-option ${model === m.value ? 'selected' : ''}`}
                                        onClick={() => { setModel(m.value); setShowModels(false); }}
                                    >
                                        {m.label}
                                        <span className="model-option-label">{m.desc}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Send / Stop */}
                        {isLoading ? (
                            <button className="send-btn send-btn-stop" onClick={onStop} title="Stop">
                                <i className='bx bx-stop' />
                            </button>
                        ) : (
                            <button
                                className="send-btn"
                                onClick={submit}
                                disabled={!text.trim() && !file}
                                title="Send"
                            >
                                <i className='bx bxs-send' style={{ fontSize: 16 }} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <p className="chat-disclaimer">Treevit can make mistakes. Verify important information.</p>
        </div>
    );
}
