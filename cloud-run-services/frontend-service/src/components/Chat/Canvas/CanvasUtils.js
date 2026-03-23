import JSZip from 'jszip';

/**
 * Utility to download a single file
 */
export const downloadFile = (code, filename) => {
    const element = document.createElement("a");
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = filename || "code-export.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

/**
 * Utility to download multiple files as a ZIP
 */
export const downloadAsZip = async (files, zipName = "project-export.zip") => {
    const zip = new JSZip();
    
    files.forEach(file => {
        zip.file(file.name, file.code);
    });
    
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    
    const element = document.createElement("a");
    element.href = url;
    element.download = zipName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

/**
 * Extracts and prepares files for the sandbox
 */
export const getSandboxFiles = (content) => {
    if (!content) return { html: '', css: '', js: '', isReact: false };

    let html = '';
    let css = '';
    let js = '';
    let isReact = false;

    if (Array.isArray(content.files)) {
        content.files.forEach(f => {
            if (f.name.endsWith('.html')) html = f.code;
            if (f.name.endsWith('.css')) css += f.code + '\n';
            if (f.name.endsWith('.js') || f.name.endsWith('.jsx')) {
                js += f.code + '\n';
                if (f.name.endsWith('.jsx') || f.code.includes('React') || f.code.includes('import React')) {
                    isReact = true;
                }
            }
        });
    } else {
        html = content.html || content;
    }

    return { html, css, js, isReact };
};
