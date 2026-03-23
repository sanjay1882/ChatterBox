import React, { useMemo } from 'react';
import { getSandboxFiles } from './CanvasUtils';

/**
 * PreviewRenderer component
 * Creates a sandboxed environment using an iframe to render generated frontend code.
 * Supports HTML, CSS, JavaScript, and React (via Babel-standalone).
 * ensures that if index.html is provided as a full document, it renders correctly.
 */
const PreviewRenderer = ({ content }) => {
    const { html, css, js, isReact } = useMemo(() => getSandboxFiles(content), [content]);

    const srcDoc = useMemo(() => {
        if (!html && !css && !js) return '';

        // If the HTML content is already a full document (starts with <!DOCTYPE or <html), 
        // we should still inject our CSS/JS if they aren't already there.
        const isFullDocument = /^\s*<(!DOCTYPE|html)/i.test(html);

        if (isFullDocument) {
            // Robust injection into full documents
            let documentBody = html;
            
            // Inject CSS before </head> if it exists
            if (css && !html.includes(css.substring(0, 20))) {
                const styleTag = `<style>${css}</style>`;
                if (documentBody.includes('</head>')) {
                    documentBody = documentBody.replace('</head>', `${styleTag}</head>`);
                } else if (documentBody.includes('</HEAD>')) {
                    documentBody = documentBody.replace('</HEAD>', `${styleTag}</HEAD>`);
                }
            }

            // Inject JS before </body>
            if (js && !html.includes(js.substring(0, 10))) {
                const scriptTag = `<script>${js}</script>`;
                if (documentBody.includes('</body>')) {
                    documentBody = documentBody.replace('</body>', `${scriptTag}</body>`);
                } else if (documentBody.includes('</BODY>')) {
                    documentBody = documentBody.replace('</BODY>', `${scriptTag}</BODY>`);
                } else {
                    documentBody += scriptTag;
                }
            }
            return documentBody;
        }

        // Otherwise, wrap snippets in our standard template
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: white; color: #333; }
                        #root { width: 100%; height: 100%; }
                        ${css}
                    </style>
                </head>
                <body>
                    ${html || '<div id="root"></div>'}
                    ${isReact ? `
                        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
                        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
                        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                        <script type="text/babel">
                            try {
                                ${js}
                                const rootElement = document.getElementById('root');
                                if (rootElement && !window.__RENDER_DONE__) {
                                    const root = ReactDOM.createRoot(rootElement);
                                    const componentToRender = typeof App !== 'undefined' ? <App /> : (typeof Main !== 'undefined' ? <Main /> : null);
                                    if (componentToRender) root.render(componentToRender);
                                    window.__RENDER_DONE__ = true;
                                }
                            } catch (e) {
                                console.error("React Preview Error:", e);
                            }
                        </script>
                    ` : `
                        <script>
                            try {
                                ${js}
                            } catch (e) {
                                console.error("Preview Script Error:", e);
                            }
                        </script>
                    `}
                </body>
            </html>
        `;
    }, [html, css, js, isReact]);

    return (
        <div className="canvas-preview-sandbox">
            <iframe
                title="Canvas Sandbox"
                srcDoc={srcDoc}
                sandbox="allow-scripts"
                className="preview-iframe"
            />
        </div>
    );
};

export default PreviewRenderer;
