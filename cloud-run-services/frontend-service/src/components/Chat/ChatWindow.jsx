import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { streamChat, getSession } from '../../services/api';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { highlightAllCodeBlocks } from '../../utils/markdown';


// same speed modifier used by plain‑JS chat to keep animation identical
const STREAMING_SPEED_MODIFIER = 500;

const SUGGESTIONS = [
    { icon: 'bx-brain', title: 'Neural Sparks', text: 'Write a creative essay or blog post with AI-powered creativity.' },
    { icon: 'bx-code-alt', title: 'Code Helper', text: 'Debug my code or explain a complex algorithm.' },
    { icon: 'bx-trending-up', title: 'Business Flow', text: 'Draft a professional email, report, or pitch deck.' },
    { icon: 'bx-bulb', title: 'HyperLearning', text: 'Explain a concept simply with analogies and examples.' },
];

export default function ChatWindow({
    sessionId,
    onSessionCreated,
    onNewSession,
    onRefreshHistory,
}) {
    const { user, token, isGuest } = useAuth();
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSession, setLoadingSession] = useState(false);
    const abortRef = useRef(null); // for stop generation
    const bottomRef = useRef(null);
    const [currentSessionId, setCurrentSessionId] = useState(sessionId);

    // Load session messages when sessionId changes
    useEffect(() => {
        setCurrentSessionId(sessionId);
        if (!sessionId) {
            setMessages([]);
            return;
        }
        const load = async () => {
            setLoadingSession(true);
            try {
                const data = await getSession(user.email, sessionId, token);
                if (data?.messages) {
                    setMessages(data.messages.map(m => ({
                        id: m._id,
                        role: m.role === 'model' ? 'ai' : m.role,
                        content: m.parts?.[0]?.text || '',
                        timestamp: m._id ? new Date(parseInt(m._id.substring(0, 8), 16) * 1000).toISOString() : null,
                    })));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSession(false);
            }
        };
        load();
    }, [sessionId]);

    // Auto-scroll & syntax highlight
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        highlightAllCodeBlocks(bottomRef.current?.parentElement);
    }, [messages]);

    const handleSend = useCallback(async ({ text, file, model, webSearch }) => {
        if (!text.trim() && !file) return;
        if (isLoading) return;

        const userMsg = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        };
        const aiMsgId = (Date.now() + 1).toString();
        const aiMsg = { id: aiMsgId, role: 'ai', content: '', timestamp: new Date().toISOString() };

        setMessages(prev => [...prev, userMsg, aiMsg]);
        setIsLoading(true);

        // local streaming state
        let fullText = "";
        let displayedText = "";
        let isStreaming = true;
        const typingDelay = 25;

        const animateText = () => {
            if (displayedText.length < fullText.length) {
                const bufferSize = fullText.length - displayedText.length;
                // mirror vanilla logic: bufferSize/STREAMING_SPEED_MODIFIER +/-
                const chunkSize = Math.max(1, Math.min(bufferSize, Math.ceil(bufferSize / STREAMING_SPEED_MODIFIER) + 1));
                displayedText += fullText.slice(displayedText.length, displayedText.length + chunkSize);
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: displayedText } : m
                ));
                setTimeout(animateText, typingDelay);
            } else if (!isStreaming) {
                setMessages(prev => prev.map(m =>
                    m.id === aiMsgId ? { ...m, content: fullText } : m
                ));
            } else {
                setTimeout(animateText, typingDelay);
            }
        };
        animateText();

        const formData = new FormData();
        formData.append('message', text);
        formData.append('email', user.email);
        formData.append('model', model || 'gemini-2.5-flash');
        formData.append('webSearch', webSearch ? 'true' : 'false');
        if (currentSessionId) formData.append('sessionId', currentSessionId);
        if (file) formData.append('image', file);

        // For guest, attach a fake token
        const authToken = isGuest ? 'guest' : token;

        try {
            await streamChat({
                formData,
                token: authToken,
                onChunk: (textChunk) => {
                    // accumulate; animation loop will update display
                    fullText += textChunk;
                },
                onSessionId: (sid) => {
                    if (!currentSessionId) {
                        setCurrentSessionId(sid);
                        onSessionCreated?.(sid);
                        onRefreshHistory?.();
                    }
                },
                onEnd: () => {
                    isStreaming = false;
                    setIsLoading(false);
                },
                onError: (err) => {
                    isStreaming = false;
                    setIsLoading(false);
                    fullText = `⚠️ Error: ${err}`;
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: fullText } : m
                    ));
                },
            });
        } catch (e) {
            isStreaming = false;
            setIsLoading(false);
            fullText = `⚠️ ${e.message}`;
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: fullText } : m
            ));
        }
    }, [isLoading, currentSessionId, user, token, isGuest]);

    const handleNewChat = useCallback(() => {
        setMessages([]);
        setCurrentSessionId(null);
        onNewSession?.();
    }, [onNewSession]);

    const handleSuggestionClick = (text) => {
        handleSend({ text, model: 'gemini-2.5-flash', webSearch: false });
    };

    if (loadingSession) {
        return (
            <div className="chat-container">
                <div className="welcome-screen">
                    <i className='bx bx-loader-alt spin' style={{ fontSize: 32, color: 'var(--accent)' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="chat-container">
            {messages.length === 0 ? (
                <div className="welcome-screen">
                    <div className="welcome-heading">
                        <h1>Hello, How Can I Help? ✨</h1>
                        <p>Ask anything, or pick a suggestion below</p>
                    </div>
                    <div className="suggestion-grid">
                        {SUGGESTIONS.map((s, i) => (
                            <div
                                key={i}
                                className="suggestion-card"
                                onClick={() => handleSuggestionClick(s.text)}
                            >
                                <div className="suggestion-card-icon">
                                    <i className={`bx ${s.icon}`} />
                                </div>
                                <h3>{s.title}</h3>
                                <p>{s.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="messages-area">
                    {messages.map(msg => (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            userPhoto={user?.photoURL}
                            userInitial={(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
                            isStreaming={isLoading && msg.id === messages[messages.length - 1]?.id && msg.role === 'ai' && msg.content === ''}
                        />
                    ))}
                    <div ref={bottomRef} />
                </div>
            )}

            <ChatInput
                onSend={handleSend}
                isLoading={isLoading}
                onStop={() => setIsLoading(false)}
            />
        </div>
    );
}
