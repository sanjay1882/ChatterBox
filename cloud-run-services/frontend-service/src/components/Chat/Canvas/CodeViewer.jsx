import React, { useState } from 'react';
import { downloadFile } from './CanvasUtils';

/**
 * CodeViewer component
 * Provides a tabbed file explorer interface for viewing multiple code files.
 * Replaces the scrolling list with a professional editor layout.
 */
const CodeViewer = ({ content }) => {
    const files = Array.isArray(content.files) ? content.files : [
        { name: content.language ? `index.${content.language}` : 'index.html', code: content.code || content }
    ];

    const [activeFileIndex, setActiveFileIndex] = useState(0);

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text);
        // Toast logic could be integrated if available in this scope
    };

    const activeFile = files[activeFileIndex] || files[0];

    return (
        <div className="canvas-code-workspace">
            {/* File Explorer Tabs */}
            <div className="code-file-tabs">
                {files.map((file, idx) => (
                    <button 
                        key={idx}
                        className={`file-tab ${activeFileIndex === idx ? 'active' : ''}`}
                        onClick={() => setActiveFileIndex(idx)}
                    >
                        <i className={`bx ${getFileIcon(file.name)}`} />
                        <span>{file.name}</span>
                    </button>
                ))}
            </div>

            {/* Active Editor Panel */}
            <div className="code-editor-panel">
                <div className="editor-header">
                    <span className="file-path">{activeFile.name}</span>
                    <div className="editor-actions">
                        <button onClick={() => handleCopy(activeFile.code)} title="Copy Code">
                            <i className='bx bx-copy' /> Copy
                        </button>
                        <button onClick={() => downloadFile(activeFile.code, activeFile.name)} title="Download File">
                            <i className='bx bx-download' />
                        </button>
                    </div>
                </div>
                <div className="editor-content-scroll">
                    <pre className="code-display">
                        <code>{activeFile.code}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
};

/**
 * Helper to get icons based on file extensions
 */
function getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'html': return 'bxs-file-html';
        case 'css': return 'bxs-file-css';
        case 'js':
        case 'jsx': return 'bxs-file-js';
        case 'json': return 'bxs-file-json';
        default: return 'bx-file';
    }
}

export default CodeViewer;
