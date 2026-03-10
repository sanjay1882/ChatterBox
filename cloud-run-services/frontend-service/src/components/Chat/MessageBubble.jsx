import { useState } from 'react';

// Simple but effective markdown renderer
// A very lightweight markdown helper for simple cases.  If a
// message already has an `html` property we trust that formatting instead
// (the chat logic now pushes formatted HTML), so this function is only used
// for backwards compatibility and for user-sent text.
function renderMarkdown(text) {
    if (!text) return '';
    let html = text
        // Code blocks
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="lang-${lang || ''}">${escapeHtml(code.trim())}</code></pre>`
        )
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Blockquote
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Lists
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr>')
        // Paragraphs — wrap lines not already wrapped
        .replace(/^(?!<[h|u|o|b|p|l|h|c|a|p|s]|<\/)(.*\S.*)$/gm, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p><\/p>/g, '');

    return html;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => { });
}

export default function MessageBubble({ msg, userPhoto, userInitial, isStreaming }) {
    const [copied, setCopied] = useState(false);

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
                <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                    {isStreaming && !msg.content ? (
                        <div className="thinking-dots">
                            <span /><span /><span />
                        </div>
                    ) : isUser ? (
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                    ) : (
                        // prefer already-formatted html (msg.html) when available
                        <div
                            dangerouslySetInnerHTML={{ __html: msg.html || renderMarkdown(msg.content) }}
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
