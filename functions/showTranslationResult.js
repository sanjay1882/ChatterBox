import formatTranslatedText from "./functions/formattedTranslatedText";


function showTranslationResult(translatedText, langName, messageId) {
    const existing = document.querySelector(`#${messageId}`).parentElement.querySelector('.translation-result');
    if (existing) existing.remove();

    const translationEl = document.createElement('div');
    translationEl.className = 'translation-result';

    
    const formattedText = formatTranslatedText(translatedText);

    translationEl.innerHTML = `
        <div class="translation-header">
            <i class='bx bx-globe'></i>
            <span>${langName} </span>
        </div>
        <div class="translation-content">${formattedText}</div>
    `;

    const messageEl = document.getElementById(messageId);
    messageEl.parentNode.insertBefore(translationEl, messageEl.nextSibling);
    translationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export default showTranslationResult;