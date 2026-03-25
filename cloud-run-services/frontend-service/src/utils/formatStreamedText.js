import { normalizeLang } from './langNormalizer.js';

// Persistent state for interactive UI across re-renders (e.g., when scrolling)
if (typeof window !== 'undefined' && !window._revealedProjects) {
    window._revealedProjects = new Set();
}

const getStableId = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36).substr(0, 8);
};

export function formatStreamedText(text) {
    if (!text) return '';

    // Remove internal system instructions from the UI
    let processedText = text.replace(/\[SYSTEM INSTRUCTION:[\s\S]*?\]/gi, '');

    // Think block extraction
    const thinkBlocks = [];
    processedText = processedText.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
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
        const langLabel = normalizeLang(block.lang);
        let langClass = `language-${langLabel}`;
        let formattedCode = escapeHTML(block.code);

        // Inline syntax highlighting — bake colors into the HTML string
        // so they persist through React re-renders (fixes colors vanishing after streaming)
        try {
            if (typeof window !== 'undefined' && window.hljs) {
                if (langLabel && langLabel !== 'plaintext' && window.hljs.getLanguage(langLabel)) {
                    formattedCode = window.hljs.highlight(block.code, { language: langLabel, ignoreIllegals: true }).value;
                } else if (langLabel !== 'plaintext') {
                    formattedCode = window.hljs.highlightAuto(block.code).value;
                }
            }
        } catch (_) {
            // Fallback: keep escaped code, zero errors
        }

        // Intercept Quiz JSON to render a beautiful UI instead of raw code
        let isQuiz = false;
        let quizTitle = "Interactive Quiz Generated";
        if (langLabel.toLowerCase() === 'json' || !langLabel) {
            if (/\"type\"\s*:\s*\"quiz\"/i.test(block.code) || /\"questions\"\s*:/i.test(block.code)) {
                isQuiz = true;
                const titleMatch = block.code.match(/\"title\"\s*:\s*\"([^\"]+)\"/i);
                if (titleMatch) quizTitle = titleMatch[1];
            }
        }

        if (isQuiz) {
            const quizContainerId = `quiz-json-${idx}`;
            // Return a themed button-like banner with source data OUTSIDE for compactness
            return `
            <div class="interactive-quiz-banner generating-pulse" onclick="window._triggerCanvasQuiz(document.getElementById('${quizContainerId}').textContent)">
                <div class="quiz-banner-icon">
                    <i class="bx bx-brain glow-icon"></i>
                </div>
                <div class="quiz-banner-text">
                    <span class="quiz-banner-title">${escapeHTML(quizTitle)}</span>
                    <span class="quiz-banner-action">Open Interactive Quiz <i class='bx bx-right-arrow-alt'></i></span>
                </div>
            </div>
            <details class="chat-quiz-details secondary-action">
                <summary>View AI Source Data <i class='bx bx-chevron-down'></i></summary>
                <div class="code-block-wrapper" data-lang="json">
                    <pre class="code-pre"><code class="language-json hljs" id="${quizContainerId}">${formattedCode}</code></pre>
                </div>
            </details>`;
        }

        // Intercept Frontend Code (HTML/CSS/JS) to render an interactive workspace banner
        // (Individual banners removed here; handled at the message level below)

        return `<div class="code-block-wrapper" data-lang="${block.lang || 'txt'}"><div class="code-header"><span class="code-lang-label">${langLabel}</span><div class="code-header-actions"><button class="copy-code-btn" onclick="window.copyCodeBlock(this)"><i class='bx bx-copy'></i> Copy</button><button class="download-code-btn" onclick="window.downloadCodeBlock(this)"><i class='bx bx-download'></i> Download</button></div></div><pre class="code-pre"><code class="${langClass} hljs">${formattedCode}</code></pre></div>`;
    });

    // Final Post-Processing for Project Decision Card
    const frontendLangs = ['html', 'css', 'javascript', 'js', 'jsx', 'react', 'typescript', 'ts'];
    const hasFrontend = codeBlocks.some(b => b.lang && frontendLangs.includes(b.lang.toLowerCase()));

    if (hasFrontend) {
        const messageId = getStableId(text);
        const isRevealed = window._revealedProjects?.has(messageId);
        const decisionCardHtml = `
        <div class="project-decision-card generating-pulse" style="display:${isRevealed ? 'none' : 'flex'}">
            <div class="decision-header">
                <div class="decision-icon">
                    <i class="bx bx-code-alt"></i>
                </div>
                <div class="decision-title-area">
                    <span class="decision-label">Interactive Workspace Ready</span>
                    <span class="decision-sublabel">I've generated a web project for you. How would you like to proceed?</span>
                </div>
            </div>
            <div class="decision-actions">
                <button class="decision-btn secondary" onclick="if(window._revealedProjects) window._revealedProjects.add('${messageId}'); const card = this.closest('.project-decision-card'); card.style.display='none'; const ra = this.closest('.animated-message-container').querySelector('.project-code-reveal-area'); ra.style.display='block';">
                    <i class='bx bx-code-curly'></i> Show Source
                </button>
                <button class="decision-btn primary" onclick="if(window._revealedProjects) window._revealedProjects.add('${messageId}'); const card = this.closest('.project-decision-card'); card.style.display='none'; window._triggerCanvasFrontend(document.getElementById('${messageId}-data').textContent)">
                    <i class='bx bx-play-circle'></i> Preview in Workspace
                </button>
            </div>
        </div>
        <div id="${messageId}-data" style="display:none">${escapeHTML(text)}</div>`;
        
        // Wrap the existing HTML in a simple reveal area, with workspace banner at end
        html = decisionCardHtml + `
        <div class="project-code-reveal-area" style="display:${isRevealed ? 'block' : 'none'}">
            ${html}
            <div class="open-workspace-banner" onclick="window._triggerCanvasFrontend(document.getElementById('${messageId}-data').textContent)">
                <div class="workspace-banner-icon"><i class='bx bx-play-circle'></i></div>
                <div class="workspace-banner-text">
                    <span class="workspace-banner-title">Open Interactive Preview</span>
                    <span class="workspace-banner-sub">Launch this project in the Workspace <i class='bx bx-right-arrow-alt'></i></span>
                </div>
            </div>
        </div>`;
    }

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
