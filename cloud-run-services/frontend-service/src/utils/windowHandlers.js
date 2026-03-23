/**
 * Global window handlers for elements rendered via dangerouslySetInnerHTML.
 * These are attached to the window object so they can be called from inline 'onclick' handlers.
 */

if (typeof window !== 'undefined') {
    window.copyCodeBlock = (btn) => {
        const wrapper = btn.closest('.code-block-wrapper') || btn.closest('.code-container');
        const code = wrapper.querySelector('code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="bx bx-check"></i> Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('copied');
            }, 2000);
        });
    };

    window.downloadCodeBlock = (btn) => {
        const wrapper = btn.closest('.code-block-wrapper') || btn.closest('.code-container');
        const code = wrapper.querySelector('code').textContent;
        const lang = wrapper.getAttribute('data-lang') || 'txt';
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `code-snippet.${lang}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    window.toggleCodeExpansion = (btn) => {
        const wrapper = btn.closest('.code-block-wrapper');
        const isExpanded = wrapper.classList.toggle('expanded');
        btn.innerHTML = isExpanded 
            ? '<i class="bx bx-chevron-up"></i> Show less' 
            : '<i class="bx bx-chevron-down"></i> Show more';
    };

    window.downloadGeneratedImage = (btn) => {
        const container = btn.closest('.generated-image-card');
        const img = container?.querySelector('.generated-image');
        if (!img) return;
        const a = document.createElement('a');
        a.href = img.src;
        a.download = `chatterbox-image-${Date.now()}.png`;
        a.click();
        btn.innerHTML = '<i class="bx bx-check"></i> Downloaded!';
        setTimeout(() => { btn.innerHTML = '<i class="bx bx-download"></i> Download'; }, 2500);
    };

    window.previewGeneratedImage = (img) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px)';
        const clone = document.createElement('img');
        clone.src = img.src;
        clone.style.cssText = 'max-width:92vw;max-height:92vh;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,0.7);object-fit:contain';
        overlay.appendChild(clone);
        overlay.onclick = () => document.body.removeChild(overlay);
        document.body.appendChild(overlay);
    };
}

export const initWindowHandlers = () => {
    // This can be called to ensure they are initialized, 
    // though the module execution above already does it.
    console.log('Window handlers initialized');
};
