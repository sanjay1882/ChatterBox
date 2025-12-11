function formatTranslatedText(text) {
        const escapeHTML = (str) =>
            str.replace(/[&<>"']/g, (tag) => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag]
            ));

        text = escapeHTML(text)
            .replace(/^### (.*$)/gim, '<h3>$1</h3>\n')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>\n')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>\n')
            .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*?)\*/gim, '<i>$1</i>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            .replace(/^\s*[-*]\s+(.*)/gim, '<li>$1</li>');

        const lines = text.split('\n');
        let html = '';
        let inList = false;

        for (let line of lines) {
            if (line.match(/<li>/)) {
                if (!inList) {
                    html += '<ul id="list-unstyled">';
                    inList = true;
                }
                html += line;
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }

                if (line.match(/<h[1-3]>/)) {
                    html += `${line}<br>`;
                } else if (line.trim()) {
                    html += `<p style="background:rgba(255, 255, 255, 0);">${line}</p>`;
                }
            }
        }
        if (inList) html += '</ul>';
        return html;
    }
export default formatTranslatedText;