/**
 * Single streaming-aware formatter that honors Gemini markers:
 * ---BEGIN MARKDOWN---  ... ---END MARKDOWN---
 *
 * Usage:
 *   const fmt = formatStreamedText((html) => container.insertAdjacentHTML('beforeend', html));
 *   // for each incoming chunk from stream:
 *   fmt.push(chunk);
 *   // when stream ends:
 *   fmt.flush();
 */
export function formatStreamedText(onHtml) {
  // State
  let buffer = "";           // buffered raw text not yet processed
  let started = false;       // became true after BEGIN marker
  let ended = false;         // became true after END marker
  let inCodeFence = false;   // inside ``` block
  let listOpen = false;

  // Escape HTML
  const escapeHTML = (s) => s.replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])
  );

  // Inline formatting (applied on text outside code fences)
  function formatInline(t) {
    // escape first
    let s = escapeHTML(t);

    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) =>
      `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );

    // inline code `code`
    s = s.replace(/`([^`]+)`/g, (_m, c) => `<code>${escapeHTML(c)}</code>`);

    // bold **bold**
    s = s.replace(/\*\*(.*?)\*\*/g, (_m, p) => `<strong>${p}</strong>`);

    // italic *italic* (avoid matching bold again)
    s = s.replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, (_m, pre, txt) => `${pre}<em>${txt}</em>`);

    return s;
  }

  // Convert complete lines to HTML fragment
  function convertLines(lines) {
    const out = [];

    for (let rawLine of lines) {
      // if marker already ended, ignore further content
      if (ended) break;

      // Normalize line endings
      let line = rawLine.replace(/\r$/, "");

      // Detect BEGIN/END markers that might appear in middle of buffer
      if (!started) {
        const beginIdx = line.indexOf('---BEGIN MARKDOWN---');
        if (beginIdx !== -1) {
          started = true;
          // take only text after marker on this line
          line = line.slice(beginIdx + '---BEGIN MARKDOWN---'.length);
          // continue processing the remainder of the line (could be blank)
        } else {
          // ignore entire line until marker found
          continue;
        }
      }

      // If END marker is present on this line, mark ended and process left side only
      const endIdx = line.indexOf('---END MARKDOWN---');
      if (endIdx !== -1) {
        ended = true;
        line = line.slice(0, endIdx);
        // we'll process what's before the end marker, then stop
      }

      // If inside a code fence
      if (inCodeFence) {
        if (line.trim().startsWith("```")) {
          // close fence
          inCodeFence = false;
          out.push("</code></pre>");
        } else {
          // preserve indentation and escape HTML (but keep newlines)
          out.push(escapeHTML(line) + "\n");
        }
        // If END marker closed the stream mid-code-block, we'll flush closing tags in flush()
        continue;
      }

      // Detect opening code fence
      const fenceMatch = line.match(/^```(\w+)?\s*$/);
      if (fenceMatch) {
        inCodeFence = true;
        const lang = fenceMatch[1] || "";
        out.push(`<pre><code class="lang-${escapeHTML(lang)}">`);
        continue;
      }

      // Headings: # .. ######
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        if (listOpen) { out.push("</ul>"); listOpen = false; }
        const lvl = h[1].length;
        out.push(`<h${lvl}>${formatInline(h[2].trim())}</h${lvl}>`);
        continue;
      }

      // Unordered list items
      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (!listOpen) { out.push('<ul class="list-unstyled">'); listOpen = true; }
        out.push(`<li>${formatInline(li[1].trim())}</li>`);
        continue;
      } else {
        if (listOpen) { out.push("</ul>"); listOpen = false; }
      }

      // Blank line -> paragraph break (emit nothing to let paragraphs accumulate client-side)
      if (line.trim() === "") {
        out.push("");
        continue;
      }

      // Normal paragraph line
      out.push(`<p>${formatInline(line.trim())}</p>`);
    }

    return out.join("\n");
  }

  // Process buffered input up to last newline; keep partial last line in buffer
  function push(chunk) {
    if (ended) return; // ignore after END marker

    buffer += chunk;

    // Process only full lines (ending with \n)
    const lastNewline = buffer.lastIndexOf("\n");
    if (lastNewline === -1) {
      // no complete line yet; but if buffer grows very large, try to process up to first double newline
      if (buffer.length > 12_000) {
        const dbl = buffer.indexOf("\n\n");
        if (dbl !== -1) {
          const toProc = buffer.slice(0, dbl + 2);
          buffer = buffer.slice(dbl + 2);
          const html = convertLines(toProc.split("\n"));
          if (html.trim()) onHtml(html);
        }
      }
      return;
    }

    const toProcess = buffer.slice(0, lastNewline + 1);
    buffer = buffer.slice(lastNewline + 1);

    const htmlFragment = convertLines(toProcess.split("\n"));
    if (htmlFragment.trim()) onHtml(htmlFragment);
  }

  // Flush any remaining partial content at end of stream
  function flush() {
    if (ended === false) {
      // There may be no explicit end marker; allow final flush but only if started
      // If not started, nothing to flush.
    }

    if (buffer.length && started && !ended) {
      // process remaining buffer
      const html = convertLines(buffer.split("\n"));
      if (html.trim()) onHtml(html);
      buffer = "";
    }

    // Close open code fence / list if necessary (if stream ended without marker)
    if (inCodeFence) {
      inCodeFence = false;
      onHtml("</code></pre>");
    }
    if (listOpen) {
      listOpen = false;
      onHtml("</ul>");
    }
  }

  // Reset formatter to reuse
  function reset() {
    buffer = "";
    started = false;
    ended = false;
    inCodeFence = false;
    listOpen = false;
  }

  // Return API: push(chunk), flush(), reset()
  return { push, flush, reset };
}
