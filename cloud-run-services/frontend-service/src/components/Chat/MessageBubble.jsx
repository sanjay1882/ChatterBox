import { useState, useEffect, useRef } from 'react';

import { renderMarkdown } from '../../utils/markdown';

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

export default function MessageBubble({ msg, userPhoto, userInitial, isStreaming }) {
    const [copied, setCopied] = useState(false);
    const bubbleRef = useRef(null);

    // Apply syntax highlighting whenever the content changes.
    // This is more robust than a global call because it re-applies colors
    // even if React re-renders the component and resets the DOM.
    useEffect(() => {
        if (bubbleRef.current && window.hljs) {
            bubbleRef.current.querySelectorAll('pre code').forEach((block) => {
                window.hljs.highlightElement(block);
            });
        }
    }, [msg.content, msg.html]);

    const handleCopy = () => {
        copyToClipboard(msg.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isUser = msg.role === 'user';

    return (
        <div className={`message-row ${isUser ? 'user-row' : ''}`}>
            <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
                {isUser ? (
                    userPhoto ? <img src={userPhoto} alt="avatar" /> : userInitial
                ) : (
                    <i className='bx bx-doughnut-chart' style={{ fontSize: 14 }} />
                )}
            </div>

            <div className="message-content">
                <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`} ref={bubbleRef}>
                    {isStreaming && !msg.content ? (
                        <div className="thinking-dots">
                            <span /><span /><span />
                        </div>
                    ) : isUser ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    ) : (
                        // prefer already-formatted html (msg.html) when available
                        <div
                            dangerouslySetInnerHTML={{ __html: msg.html || renderMarkdown(msg.content, isStreaming) }}
                        />
                    )}
                </div>

                {/* Actions */}
                {!isUser && msg.content && (
                    <div className="message-actions">
                        <button
                            className="message-action-btn"
                            onClick={handleCopy}
                            title={copied ? 'Copied!' : 'Copy'}
                        >
                            <i className={`bx ${copied ? 'bx-check' : 'bx-copy'}`} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
