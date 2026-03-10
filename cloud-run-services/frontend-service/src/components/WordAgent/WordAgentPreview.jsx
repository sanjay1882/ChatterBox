import { useState, useRef, useEffect, useCallback } from "react";

const QUICK_PROMPTS = [
  "Summarize this document",
  "Fix grammar & spelling",
  "Make it more professional",
  "Add an executive summary",
  "Expand with more detail",
  "Convert to bullet points",
];

const WELCOME = {
  role: "ai",
  content: "Upload a .docx or .txt file, or start from a blank document. I can write, rewrite, summarize, format, and edit — just tell me what you need.",
};

const SAMPLE_DOC = `# Project Proposal: AI Documentation Suite

## Overview

This document outlines the proposed development of an AI-powered documentation suite designed to streamline content creation and editing workflows for enterprise teams.

## Objectives

- Reduce document creation time by 60%
- Improve consistency across organizational communications
- Enable real-time collaborative AI-assisted editing

## Timeline

The project is estimated to span 12 weeks across three phases:

### Phase 1 — Research & Design
Weeks 1–3: User research, competitive analysis, and UX wireframing.

### Phase 2 — Development
Weeks 4–9: Core feature implementation and backend integration.

### Phase 3 — Testing & Launch
Weeks 10–12: QA, beta testing, and production deployment.

## Budget

Estimated total investment: $240,000 including engineering, design, and infrastructure costs.`;

function wordCount(t) { return t.trim() ? t.trim().split(/\s+/).length : 0; }

function SimpleMarkdown({ text }) {
  if (!text) return null;
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function DocPreview({ content }) {
  if (!content) return <p style={{ color: "#7a7f96", fontStyle: "italic" }}>Your document will appear here…</p>;
  const lines = content.split("\n");
  return (
    <div style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.85, color: "#e8eaf0" }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 10 }} />;
        if (/^# (.+)/.test(line)) return <h1 key={i} style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 400, margin: "0 0 18px", color: "#e8eaf0", borderBottom: "2px solid #2a2d3e", paddingBottom: 10 }}>{line.replace(/^# /, "")}</h1>;
        if (/^## (.+)/.test(line)) return <h2 key={i} style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 400, margin: "24px 0 10px", color: "#c8cad8" }}>{line.replace(/^## /, "")}</h2>;
        if (/^### (.+)/.test(line)) return <h3 key={i} style={{ fontFamily: "Georgia,serif", fontSize: 16, fontWeight: 400, margin: "16px 0 6px", color: "#9a9db0" }}>{line.replace(/^### /, "")}</h3>;
        if (/^- (.+)/.test(line)) return <li key={i} style={{ marginLeft: 20, marginBottom: 4 }}>{line.replace(/^- /, "")}</li>;
        return <p key={i} style={{ margin: "0 0 12px" }}>{line}</p>;
      })}
    </div>
  );
}

export default function WordAgent() {
  const [docContent, setDocContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(0);
  const [viewMode, setViewMode] = useState("preview");
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [mobileTab, setMobileTab] = useState("chat");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 700);

  const msgsBottom = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    msgsBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    const h = (e) => setIsMobile(window.innerWidth <= 700);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // Resizer
  const startResizing = useCallback((e) => { e.preventDefault(); setIsResizing(true); }, []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const doResizing = useCallback((e) => {
    if (isResizing) { const w = e.clientX; if (w > 240 && w < 700) setChatWidth(w); }
  }, [isResizing]);
  useEffect(() => {
    if (isResizing) { window.addEventListener("mousemove", doResizing); window.addEventListener("mouseup", stopResizing); }
    else { window.removeEventListener("mousemove", doResizing); window.removeEventListener("mouseup", stopResizing); }
    return () => { window.removeEventListener("mousemove", doResizing); window.removeEventListener("mouseup", stopResizing); };
  }, [isResizing, doResizing, stopResizing]);

  const saveHistory = (c) => {
    setHistory(p => { const n = p.slice(0, historyIndex + 1); n.push(c); return n.slice(-50); });
    setHistoryIndex(p => Math.min(p + 1, 49));
  };
  const undo = () => { if (historyIndex <= 0) return; setDocContent(history[historyIndex - 1]); setHistoryIndex(h => h - 1); };
  const redo = () => { if (historyIndex >= history.length - 1) return; setDocContent(history[historyIndex + 1]); setHistoryIndex(h => h + 1); };

  const loadDoc = (name, content) => {
    setOpenFiles(p => p.some(f => f.name === name) ? p : [...p, { name, content }]);
    setActiveFile(openFiles.length);
    setDocContent(content);
    setFileName(name);
    setIsDirty(false);
    saveHistory(content);
    setMessages(p => [...p, { role: "ai", content: `✅ Opened **${name}** — ${wordCount(content)} words loaded.` }]);
  };

  const handleFileChange = (e) => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => loadDoc(file.name, ev.target.result);
      reader.readAsText(file);
    });
    e.target.value = null;
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    Array.from(e.dataTransfer.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => loadDoc(file.name, ev.target.result);
      reader.readAsText(file);
    });
  };

  const closeFile = (idx) => {
    const updated = openFiles.filter((_, i) => i !== idx);
    setOpenFiles(updated);
    const na = Math.max(0, idx - 1);
    setActiveFile(na);
    if (updated.length > 0) { setDocContent(updated[na].content); setFileName(updated[na].name); }
    else { setDocContent(""); setFileName(""); }
  };

  const switchFile = (idx) => { setActiveFile(idx); setDocContent(openFiles[idx].content); setFileName(openFiles[idx].name); };

  // Stub AI send
  const sendMessage = async (msgText) => {
    const txt = msgText ?? input.trim();
    if (!txt || isThinking) return;
    setInput("");
    setMessages(p => [...p, { role: "user", content: txt }]);
    setIsThinking(true);
    const id = Date.now();
    setMessages(p => [...p, { role: "ai", content: "", id }]);
    await new Promise(r => setTimeout(r, 1100));
    const reply = `Got it! You asked: **"${txt}"**\n\nConnect your backend to process the document and stream the response here.`;
    setMessages(p => p.map(m => m.id === id ? { ...m, content: reply } : m));
    setIsThinking(false);
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const hasDoc = docContent.length > 0 || openFiles.length > 0;
  const wc = wordCount(docContent);

  // ── Styles (all inline so it's self-contained) ──
  const C = {
    bg: "#0f1117", surface: "#181b23", surface2: "#1e2130",
    border: "#2a2d3e", blue: "#4f87ff", blueDim: "#1e2d54",
    green: "#34c47c", amber: "#f5a623", red: "#ff5757",
    text: "#e8eaf0", muted: "#7a7f96", dim: "#4a4f66",
  };

  const chatPanelStyle = isMobile
    ? { display: mobileTab === "chat" ? "flex" : "none", flexDirection: "column", width: "100%", height: "calc(100% - 48px)", background: "#13161f", borderRight: `1px solid ${C.border}` }
    : { display: "flex", flexDirection: "column", width: chatWidth, minWidth: chatWidth, background: "#13161f", borderRight: `1px solid ${C.border}`, flexShrink: 0, height: "100%" };

  const canvasStyle = isMobile
    ? { display: mobileTab === "doc" ? "flex" : "none", flexDirection: "column", flex: 1, background: C.bg, overflow: "hidden", height: "calc(100% - 48px)" }
    : { display: "flex", flexDirection: "column", flex: 1, background: C.bg, overflow: "hidden" };

  const btnBase = { display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 6, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: "1px solid transparent", transition: "all 0.15s", whiteSpace: "nowrap" };
  const btnGhost = { ...btnBase, background: C.surface2, borderColor: C.border, color: C.muted };
  const btnPrimary = { ...btnBase, background: C.blue, color: "#fff", borderColor: C.blue };
  const btnSuccess = { ...btnBase, background: "transparent", color: C.green, borderColor: C.green };
  const btnSquare = { ...btnGhost, width: 30, height: 30, padding: 0, justifyContent: "center" };

  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text, overflow: "hidden", flexDirection: isMobile ? "column" : "row", position: "relative", cursor: isResizing ? "col-resize" : "default", userSelect: isResizing ? "none" : "auto" }}>

      {/* Mobile tabs */}
      {isMobile && (
        <div style={{ display: "flex", height: 48, background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {[["chat", "💬", "Chat"], ["doc", "📄", "Document"]].map(([tab, icon, label]) => (
            <button key={tab} onClick={() => setMobileTab(tab)} style={{ flex: 1, background: "none", border: "none", color: mobileTab === tab ? C.blue : C.muted, fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderBottom: mobileTab === tab ? `2px solid ${C.blue}` : "2px solid transparent" }}>
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Left: Chat Panel ── */}
      <div style={chatPanelStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 8, background: C.blueDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📝</div>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 400, color: C.text }}>Word Agent</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>AI-powered document editor</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 13px", display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={msg.id || i} style={{ display: "flex", gap: 9, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: msg.role === "ai" ? C.blueDim : C.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                {msg.role === "ai" ? "🤖" : "👤"}
              </div>
              <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.6, background: msg.role === "ai" ? C.surface : C.blue, border: msg.role === "ai" ? `1px solid ${C.border}` : "none", color: C.text, borderTopLeftRadius: msg.role === "ai" ? 3 : 10, borderTopRightRadius: msg.role === "user" ? 3 : 10 }}>
                {isThinking && i === messages.length - 1 && !msg.content
                  ? <span style={{ display: "flex", gap: 4 }}>{[0, 0.2, 0.4].map((d, j) => <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, display: "inline-block", animation: `bounce 1.2s ${d}s infinite` }} />)}</span>
                  : <SimpleMarkdown text={msg.content} />
                }
              </div>
            </div>
          ))}
          <div ref={msgsBottom} />
        </div>

        {/* Input area */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 9, background: C.surface, flexShrink: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {QUICK_PROMPTS.map((p, i) => (
              <span key={i} onClick={() => sendMessage(p)} style={{ padding: "3px 9px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11.5, color: C.muted, cursor: "pointer", whiteSpace: "nowrap" }}>{p}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Tell the AI what to do…" rows={2}
              style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: "inherit", fontSize: 13.5, padding: "9px 11px", resize: "none", outline: "none", lineHeight: 1.5 }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || isThinking}
              style={{ width: 36, height: 36, borderRadius: 6, background: C.blue, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", opacity: (!input.trim() || isThinking) ? 0.4 : 1, flexShrink: 0 }}>
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* ── Resizer ── */}
      {!isMobile && (
        <div onMouseDown={startResizing} style={{ width: 5, background: isResizing ? C.blue : C.border, cursor: "col-resize", flexShrink: 0, transition: "background 0.2s", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 3, height: 30, borderRadius: 3, background: "#353850" }} />
        </div>
      )}

      {/* ── Right: Canvas ── */}
      <div style={canvasStyle}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 13px", borderBottom: `1px solid ${C.border}`, background: C.surface, minHeight: 50, flexShrink: 0, gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, overflowX: "auto" }}>
            {openFiles.map((f, fi) => (
              <div key={fi} onClick={() => switchFile(fi)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 6, background: fi === activeFile ? C.blueDim : C.surface2, border: `1px solid ${fi === activeFile ? C.blue : C.border}`, color: fi === activeFile ? C.blue : C.muted, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>
                📄 {f.name}
                <span onClick={e => { e.stopPropagation(); closeFile(fi); }} style={{ fontSize: 13, opacity: 0.6, cursor: "pointer", marginLeft: 2 }}>✕</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* View toggle */}
            {hasDoc && (
              <div style={{ display: "flex", gap: 2, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: 2 }}>
                {[["edit", "✏️", "Edit"], ["split", "⊞", "Split"], ["preview", "👁", "Preview"]].map(([mode, icon, label]) => (
                  <button key={mode} onClick={() => setViewMode(mode)} title={label}
                    style={{ ...btnSquare, background: viewMode === mode ? C.blueDim : "transparent", borderColor: viewMode === mode ? C.blue : "transparent", color: viewMode === mode ? C.blue : C.muted, border: `1px solid ${viewMode === mode ? C.blue : "transparent"}` }}>
                    {icon}
                  </button>
                ))}
              </div>
            )}
            {/* Undo/Redo */}
            {hasDoc && (
              <div style={{ display: "flex", gap: 2 }}>
                <button onClick={undo} disabled={historyIndex <= 0} style={{ ...btnSquare, opacity: historyIndex <= 0 ? 0.35 : 1 }} title="Undo">↩</button>
                <button onClick={redo} disabled={historyIndex >= history.length - 1} style={{ ...btnSquare, opacity: historyIndex >= history.length - 1 ? 0.35 : 1 }} title="Redo">↪</button>
              </div>
            )}
            <label style={{ ...btnPrimary, cursor: "pointer" }}>
              ＋ Add File
              <input type="file" accept=".txt,.md" multiple hidden onChange={handleFileChange} ref={fileRef} />
            </label>
            {hasDoc && (
              <button style={btnSuccess} onClick={() => {
                const b = new Blob([docContent], { type: "text/plain" });
                const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: fileName || "document.txt" });
                a.click();
              }}>⬇ Download</button>
            )}
          </div>
        </div>

        {/* Body */}
        {!hasDoc ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", maxWidth: 460, padding: "56px 40px", border: `2px dashed ${isDragOver ? C.blue : C.border}`, borderRadius: 14, background: isDragOver ? C.blueDim : C.surface, cursor: "pointer", transition: "all 0.2s", textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 4 }}>☁️</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: C.text }}>Drop your document here</div>
              <div style={{ fontSize: 12.5, color: C.muted }}>or click to browse</div>
              <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
                {[".docx", ".txt", ".md"].map(ext => (
                  <span key={ext} style={{ padding: "2px 9px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 20, fontSize: 11.5, color: C.muted }}>{ext}</span>
                ))}
              </div>
            </div>
            <button onClick={() => { setDocContent(SAMPLE_DOC); setFileName("Sample Document.txt"); setOpenFiles([{ name: "Sample Document.txt", content: SAMPLE_DOC }]); setActiveFile(0); setViewMode("preview"); saveHistory(SAMPLE_DOC); setMessages(p => [...p, { role: "ai", content: "✅ Loaded a **sample document** so you can explore the interface." }]); }}
              style={{ ...btnGhost, fontSize: 13, padding: "8px 18px" }}>
              📄 Load sample document
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            {/* Edit pane */}
            {(viewMode === "edit" || viewMode === "split") && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: viewMode === "split" ? `1px solid ${C.border}` : "none" }}>
                <div style={{ padding: "4px 14px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, borderBottom: `1px solid ${C.border}`, background: C.surface }}>Edit</div>
                <textarea value={docContent} onChange={e => { setDocContent(e.target.value); setIsDirty(true); }} onBlur={() => saveHistory(docContent)}
                  style={{ flex: 1, padding: "26px 30px", background: C.bg, border: "none", outline: "none", resize: "none", color: C.text, fontFamily: "'Courier New', monospace", fontSize: 14, lineHeight: 1.75, overflowY: "auto" }} />
              </div>
            )}
            {/* Preview pane */}
            {(viewMode === "preview" || viewMode === "split") && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "4px 14px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim, borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>Preview</div>
                <div style={{ flex: 1, overflowY: "auto", background: C.bg, padding: 24 }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, maxWidth: 720, margin: "0 auto", minHeight: "100%", padding: "56px 64px", boxShadow: "0 4px 32px rgba(0,0,0,0.35)", borderRadius: 4 }}>
                    <DocPreview content={docContent} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status bar */}
        {hasDoc && (
          <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "5px 14px", background: C.surface, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, flexShrink: 0 }}>
            <span>📝 <strong style={{ color: C.text }}>{wc}</strong> words</span>
            <span>🔤 <strong style={{ color: C.text }}>{docContent.length}</strong> chars</span>
            {isDirty && <span style={{ color: C.amber }}>✏️ Unsaved changes</span>}
            <span style={{ marginLeft: "auto", fontSize: 11.5 }}>📄 {fileName}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-5px);opacity:1} }
        textarea::placeholder { color: #4a4f66; }
        textarea { caret-color: #4f87ff; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 3px; }
      `}</style>
    </div>
  );
}
