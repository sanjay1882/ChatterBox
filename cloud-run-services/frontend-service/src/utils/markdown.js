// Markdown renderer matching the original formatResponse() function in index.js
// Also calls hljs.highlightElement() for syntax highlighting (highlight.js loaded via CDN in index.html)

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Render markdown to HTML string.
 * After inserting this HTML into the DOM, call highlightAllCodeBlocks()
 * so highlight.js can do syntax highlighting.
 */
export function renderMarkdown(text) {
    if (!text) return '';

    let responseText = text;

    // ── Code blocks ──────────────────────────────────────────────────────────
    responseText = responseText.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) => {
        const langLabel = lang || '';
        const trimCode = code.trim();
        let formattedCode = escapeHtml(trimCode);

        try {
            if (window.hljs) {
                if (langLabel && window.hljs.getLanguage(langLabel)) {
                    formattedCode = window.hljs.highlight(trimCode, { language: langLabel, ignoreIllegals: true }).value;
                } else {
                    formattedCode = window.hljs.highlightAuto(trimCode).value;
                }
            }
        } catch (e) {
            console.error("Syntax Highlighting Error:", e);
        }

        return `<div class="code-container"><div class="code-header"><span class="progem-lan">${langLabel}</span><button class="copy-code-btn" onclick="(function(btn){var code=btn.closest('.code-container').querySelector('code');navigator.clipboard.writeText(code.innerText).then(function(){var orig=btn.innerHTML;btn.innerHTML='<i class=\\'bx bx-check\\'></i> Copied';setTimeout(function(){btn.innerHTML=orig},2000)});})(this)"><i class='bx bx-copy'></i> Copy</button></div><pre><code class="language-${langLabel} hljs">${formattedCode}</code></pre></div>`;
    });

    // ── Inline code ──────────────────────────────────────────────────────────
    responseText = responseText.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    // ── Bold + italic combos ─────────────────────────────────────────────────
    responseText = responseText.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>');
    responseText = responseText.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
    responseText = responseText.replace(/\*(.+?)\*/gs, '<em>$1</em>');
    responseText = responseText.replace(/__(.+?)__/gs, '<strong>$1</strong>');
    responseText = responseText.replace(/_([^_]+)_/gs, '<em>$1</em>');

    // ── Headings ─────────────────────────────────────────────────────────────
    responseText = responseText.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    responseText = responseText.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    responseText = responseText.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    responseText = responseText.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // ── Horizontal rule ──────────────────────────────────────────────────────
    responseText = responseText.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="md-hr">');

    // ── Blockquote ───────────────────────────────────────────────────────────
    responseText = responseText.replace(/^> (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

    // ── Tables ───────────────────────────────────────────────────────────────
    responseText = responseText.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (match, header, rows) => {
        const headers = header.split('|').map(h => h.trim()).filter(Boolean);
        const rowsArr = rows.trim().split('\n').map(row =>
            row.split('|').map(c => c.trim()).filter(Boolean)
        );
        const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        const tbody = rowsArr.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<table class="md-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    });

    // ── Unordered lists ──────────────────────────────────────────────────────
    responseText = responseText.replace(/((?:^[ \t]*[-*+] .+$\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(line =>
            `<li>${line.replace(/^[ \t]*[-*+] /, '').trim()}</li>`
        ).join('');
        return `<ul class="md-ul">${items}</ul>`;
    });

    // ── Ordered lists ────────────────────────────────────────────────────────
    responseText = responseText.replace(/((?:^[ \t]*\d+\. .+$\n?)+)/gm, (block) => {
        const items = block.trim().split('\n').map(line =>
            `<li>${line.replace(/^[ \t]*\d+\. /, '').trim()}</li>`
        ).join('');
        return `<ol class="md-ol">${items}</ol>`;
    });

    // ── Links ────────────────────────────────────────────────────────────────
    responseText = responseText.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>'
    );

    // ── Paragraphs / line breaks ─────────────────────────────────────────────
    responseText = responseText.replace(/\n\n/g, '<br><br>');
    responseText = responseText.replace(/\n(?!<)/g, '<br>');

    return responseText;
}

/**
 * Call after rendering markdown HTML into the DOM.
 * This runs highlight.js on all code blocks.
 */
export function highlightAllCodeBlocks(container) {
    if (!container || typeof window === 'undefined') return;
    const hljs = window.hljs;
    if (!hljs) return;
    container.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
    });
}
