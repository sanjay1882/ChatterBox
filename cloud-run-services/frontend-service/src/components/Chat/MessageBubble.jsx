import { useState, useEffect, useRef, memo } from 'react';

import { renderMarkdown } from '../../utils/markdown';
import { normalizeLang } from '../../utils/langNormalizer';

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

function MessageBubble({ msg, userPhoto, userInitial, isStreaming }) {
    const [copied, setCopied] = useState(false);
    const bubbleRef = useRef(null);

    // Apply syntax highlighting whenever the content changes.
    useEffect(() => {
        if (bubbleRef.current && window.hljs) {
            bubbleRef.current.querySelectorAll('pre code').forEach((block) => {
                // Normalize the language class before highlighting
                const langMatch = block.className.match(/language-(\S+)/);
                if (langMatch) {
                    const normalized = normalizeLang(langMatch[1]);
                    block.className = block.className.replace(/language-\S+/, `language-${normalized}`);
                }
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

// Custom comparison to avoid re-rendering if the message content hasn't changed.
// This preserves interactive states purely handled by the DOM (like <details> open state)
// when the parent re-renders (e.g. on scroll).
export default memo(MessageBubble, (prevProps, nextProps) => {
    return (
        prevProps.msg.content === nextProps.msg.content &&
        prevProps.msg.html === nextProps.msg.html &&
        prevProps.isStreaming === nextProps.isStreaming &&
        prevProps.userPhoto === nextProps.userPhoto &&
        prevProps.userInitial === nextProps.userInitial
    );
});
