// Copied and slightly adapted from the original non‑React frontend (frontend/chat/index.js)
// This version returns a string of HTML for the entire text passed in.  It handles
// think blocks, code fences (including incomplete streaming fences), tables, inline
// markdown, math, etc.  The React components can call this on every frame without
// needing a streaming-specific API.

export function formatStreamedText(text) {
    if (!text) return '';

    // Think block extraction
    const thinkBlocks = [];
    let processedText = text.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
        thinkBlocks.push(content);
        return `__THINK_BLOCK_${thinkBlocks.length - 1}__`;
    });

    const openThinkMatch = processedText.match(/<think>([\s\S]*)$/);
    if (openThinkMatch) {
        const content = openThinkMatch[1];
        thinkBlocks.push(content);
        processedText = processedText.replace(/<think>([\s\S]*)$/, `__THINK_BLOCK_${thinkBlocks.length - 1}__`);
    }

    // Code block extraction — BEFORE escapeHTML to prevent corruption
    // This also handles streaming (incomplete) code blocks
    const codeBlocks = [];

    // 1. Extract complete code blocks (``` ... ```)  
    processedText = processedText.replace(/```(\w*)[ \t]*\n?([\s\S]*?)```/gim, (match, lang, code) => {
        codeBlocks.push({ lang: (lang || '').trim(), code });
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 2. Extract incomplete code blocks (streaming: ``` opened but not yet closed)
    processedText = processedText.replace(/```(\w*)[ \t]*\n?([\s\S]*)$/gim, (match, lang, code) => {
        codeBlocks.push({ lang: (lang || '').trim(), code });
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Math block extraction
    const mathBlocks = [];
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
        mathBlocks.push({ content: content, display: true });
        return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
    });

    processedText = processedText.replace(/\$([^$\n]+?)\$/g, (match, content) => {
        mathBlocks.push({ content: content, display: false });
        return `__MATH_INLINE_${mathBlocks.length - 1}__`;
    });

    // Handle streaming (incomplete) display math
    processedText = processedText.replace(/\$\$([\s\S]*)$/g, (match, content) => {
        mathBlocks.push({ content: content, display: true });
        return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
    });

    const escapeHTML = (str) =>
        String(str).replace(/[&<>"']/g, (tag) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag]
        ));

    function createTableHTMLFromLines(rows) {
        if (!rows || !rows.length) return '';

        const parse = (r) =>
            r.replace(/^\|/, '')
                .replace(/\|$/, '')
                .split('|')
                .map(c => c.trim());

        const header = parse(rows[0]);
        let alignments = new Array(header.length).fill(null);

        if (rows.length > 1) {
            const divider = rows[1].replace(/\s+/g, '');
            if (/^[:\-|—–+]+$/.test(divider)) {
                const divCells = parse(rows[1]);
                alignments = divCells.map(cell => {
                    const left = cell.startsWith(':');
                    const right = cell.endsWith(':');
                    if (left && right) return 'center';
                    if (right) return 'right';
                    if (left) return 'left';
                    return null;
                });
                rows.splice(1, 1); // Remove the divider row so it doesn't render as a body row
            }
        }

        let html = '<br><table class="md-table"><thead><tr>';
        for (let i = 0; i < header.length; i++) {
            const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
            html += `<th${align}>${header[i] || ''}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let r = 1; r < rows.length; r++) {
            const cells = parse(rows[r]);
            html += '<tr>';
            for (let i = 0; i < header.length; i++) {
                const cell = (cells[i] !== undefined) ? cells[i] : '';
                const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
                html += `<td${align}>${cell}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table><br>';
        return html;
    }

    processedText = escapeHTML(processedText)
        .replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, '<span class="emoji-reset">$1</span>')
        .replace(/^[-*_]{3,}\s*$/gm, '') // Remove horizontal rules
        .replace(/^###### (.*$)/gim, '<h6>$1</h6>\n')
        .replace(/^##### (.*$)/gim, '<h5>$1</h5>\n')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>\n')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>\n')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>\n')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>\n')
        .replace(/\*\*\*(.*?)\*\*\*/gim, '<b><i>$1</i></b>')
        .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*?)\*/gim, '<i>$1</i>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" class="styled-link"><i class="bx bx-link"></i> $1</a>')
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/^\s*[-*]\s+(.*)/gim, '<li>$1</li>');

    const lines = processedText.split('\n');
    let html = '';
    let inList = false;
    let inTable = false;
    let inCodeBlock = false;
    let tableLines = [];

    for (let line of lines) {
        const trimmed = line.trim();
        const pipeCount = (line.match(/\|/g) || []).length;

        // Detect start of a pre/code block
        if (line.match(/^<pre><code/)) {
            inCodeBlock = true;
            html += `${line}\n`;
            if (line.match(/<\/code><\/pre>/)) {
                inCodeBlock = false;
            }
            continue;
        }

        // Inside a code block — emit raw, don't wrap in <p>
        if (inCodeBlock) {
            if (line.match(/<\/code><\/pre>/)) {
                inCodeBlock = false;
            }
            html += `${line}\n`;
            continue;
        }

        // Pass code-block placeholders through raw (restored later)
        if (trimmed.match(/^__(?:CODE|MATH)_BLOCK_\d+__$/)) {
            html += trimmed;
            continue;
        }

        const looksLikeTableRow = pipeCount >= 2 && !/<pre><code>/.test(line) && !/<\/code><\/pre>/.test(line);

        if (looksLikeTableRow) {
            inTable = true;
            tableLines.push(line);
            continue;
        }

        if (inTable && tableLines.length) {
            html += createTableHTMLFromLines(tableLines);
            tableLines = [];
            inTable = false;
        }

        if (line.match(/<li>/)) {
            if (!inList) {
                html += '<ul id="list-unstyled">';
                inList = true;
            }
            html += line;
            continue;
        } else if (line.trim() !== '') {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
        }

        if (line.match(/<h[1-6]/)) {
            html += `${line}`;
            continue;
        }

        if (trimmed) {
            html += `<p>${line}</p>`;
        } else {
            html += ``;
        }
    }

    if (inTable && tableLines.length) {
        html += createTableHTMLFromLines(tableLines);
    }

    // restore think blocks
    html = html.replace(/__THINK_BLOCK_(\d+)__/g, (_m, idx) => {
        const content = thinkBlocks[parseInt(idx, 10)];
        const safe = escapeHTML(content);
        return `<div class="think-block-wrapper"><details class="think-block-details"><summary>💭 Thought</summary><div class="think-block-content">${safe}</div></details></div>`;
    });

    // restore code blocks with premium ChatGPT/Claude-style HTML
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (_m, idx) => {
        const block = codeBlocks[parseInt(idx, 10)];
        if (!block) return _m;
        const langLabel = block.lang || 'plaintext';
        let langClass = block.lang ? `language-${block.lang}` : 'language-plaintext';
        let formattedCode = escapeHTML(block.code);

        // Note: Highlighting is handled globally by highlightAllCodeBlocks or prism
        return `<div class="code-block-wrapper" data-lang="${block.lang || 'txt'}"><div class="code-header"><span class="code-lang-label">${langLabel}</span><div class="code-header-actions"><button class="copy-code-btn" onclick="window.copyCodeBlock(this)"><i class='bx bx-copy'></i> Copy</button><button class="download-code-btn" onclick="window.downloadCodeBlock(this)"><i class='bx bx-download'></i> Download</button></div></div><pre class="code-pre"><code class="${langClass}">${formattedCode}</code></pre></div>`;
    });

    // restore math
    html = html.replace(/__MATH_BLOCK_(\d+)__/g, (_m, idx) => {
        const block = mathBlocks[parseInt(idx, 10)];
        if (!block) return _m;
        try {
            if (window.katex) {
                return window.katex.renderToString(block.content, { 
                    displayMode: block.display, 
                    throwOnError: false,
                    trust: true
                });
            }
        } catch (err) {
            console.error("KaTeX error:", err);
        }
        return block.display ? `<div class="math-block">${escapeHTML(block.content)}</div>` : `<span class="math-inline">${escapeHTML(block.content)}</span>`;
    });

    html = html.replace(/__MATH_INLINE_(\d+)__/g, (_m, idx) => {
        const block = mathBlocks[parseInt(idx, 10)];
        if (!block) return _m;
        try {
            if (window.katex) {
                return window.katex.renderToString(block.content, { 
                    displayMode: block.display, 
                    throwOnError: false,
                    trust: true
                });
            }
        } catch (err) {
            console.error("KaTeX error:", err);
        }
        return block.display ? `<div class="math-block">${escapeHTML(block.content)}</div>` : `<span class="math-inline">${escapeHTML(block.content)}</span>`;
    });

    return html;
}
