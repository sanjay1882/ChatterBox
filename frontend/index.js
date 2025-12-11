let chatInput = document.querySelector(".chat-input textarea");
const chatbox = document.querySelector(".chatbox");
const hometagContent = document.getElementById("home-tag-contentID");


// Streaming Speed Factor: Lower = Faster, Higher = Slower
// A value of 5 provides a snappy, ChatGPT-like feel.
const STREAMING_SPEED_MODIFIER = 500;

const alertMessages = [
    "Whoa there! That field’s feeling lonely.",
    "Blank space detected. Let’s fill it with brilliance!",
    "Don’t ghost this field — it needs you!",
    "Silence isn’t golden here. Type something!",
    "This box craves your words. Don’t leave it hanging.",
    "Hey! Your thoughts belong here — don’t hold back.",
    "Empty fields make sad forms. Cheer it up with some text!",
    "Your keyboard’s waiting. Give this field a little love.",
    "No input? No progress. Let’s fix that!",
    "This space is reserved for your genius — don’t skip it!"
];

let userMessage;
let currentSessionId = null;
let isTemporaryMode = false;

let sidebar = document.querySelector(".sidebar");
let closeBtn = document.querySelector("#btn");
let closeBtn1 = document.querySelector("#btn1");

let sendButton = document.getElementById("send-button");

closeBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.getElementById("btn1").style.display = "block";
});



closeBtn1.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.getElementById("btn1").style.display = "none";
});

document.querySelectorAll("#sugg, #sugg2, #sugg3, #sugg4, #sugg5, #sugg6")
    .forEach(el => {
        el.addEventListener("click", () => {
            chatInput.value = el.textContent.trim();
            ChatHandle();
        });
    });

const plusBtn = document.getElementById('plus-btn');
const actionsMenu = document.getElementById('input-actions-menu');

if (plusBtn && actionsMenu) {
    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        actionsMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!actionsMenu.contains(e.target) && e.target !== plusBtn) {
            actionsMenu.classList.remove('show');
        }
    });
}

function init() {
    document.getElementById('preloader').style.display = 'none';
    document.body.style.visibility = 'visible';
    document.body.style.overflow = 'auto';
    // Load User Preferences
    // We need to wait for email, but assuming loadSessions handles getting email or it's global?
    // loggedUserEmail is often set in login logic. If init() runs on reload, we might need to get it from localStorage or wait.
    // Let's assume loggedUserEmail is available or handled by authentication flow first.
    // If not, we might need to call this after login/auth check.
    // For now, let's call it if email exists globally or in local storage.
    const storedEmail = localStorage.getItem('chat_user_email'); // Assuming we store it
    if (storedEmail) {
        loadUserPreferences(storedEmail);
    }

    loadSessions();
    initSettings();
}

if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}

// Initial random greeting
if (document.getElementById("Greet-tag")) {
    const greetings = [
        "How can I assist you today?",
        "What brings you here?",
        "Need a hand with something?",
        "How may I help?",
        "Ready to get started?",
        "What can I do for you?",
        "How can I support you today?",
        "What’s on your mind?",
        "How can I help this time?",
        "What do you need today?"
    ];
    const greetTag = document.getElementById("Greet-tag");
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    greetTag.textContent = randomGreeting;
}

document.querySelector(".Newchat-Btn a").addEventListener("click", (e) => {
    e.preventDefault();
    startNewChat();
});

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        const isWhite = themeToggle.checked;
        document.body.classList.toggle('white-mode', isWhite);
        const mode = isWhite ? 'white' : 'dark';
        document.getElementById('theme-status').textContent = isWhite ? 'White Mode' : 'Dark Mode';

        // Auto-save theme
        saveUserPreferences({ theme: mode });
    });
}





function createActionButtons(messageId, messageText, isComplete = false) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'chat-actions';

    if (!isComplete) {
        actionsDiv.style.display = 'none';
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-btn';
    copyBtn.innerHTML = '<i class="bx bx-copy" title="Copy"></i>';
    copyBtn.onclick = () => copyToClipboard(messageText, messageId);

    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn share-btn';
    shareBtn.innerHTML = '<i class="bx bx-share-alt" title="Share"></i>';
    shareBtn.onclick = () => shareMessage(messageText);

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'action-btn download-btn';
    downloadBtn.innerHTML = '<i class="bx bx-download" title="Download"></i>';
    downloadBtn.onclick = () => downloadMessage(messageText);

    const translateBtn = document.createElement('button');
    translateBtn.className = 'action-btn translate-btn';
    translateBtn.innerHTML = '<i class="bx  bx-translate" title="Translate"></i> ';
    translateBtn.onclick = (e) => showTranslationOptions(e, messageText, messageId);

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'action-btn regenerate';
    regenerateBtn.innerHTML = '<i class="bx bx-refresh" title="Regenerate response"></i>';
    regenerateBtn.onclick = () => regenerateResponse(messageId, messageText);

    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(shareBtn);
    actionsDiv.appendChild(downloadBtn);
    actionsDiv.appendChild(translateBtn);

    const speakBtn = document.createElement('button');
    speakBtn.className = 'action-btn speak-btn';
    speakBtn.innerHTML = '<i class="bx bx-volume-full" title="Listen"></i>';
    speakBtn.onclick = () => speakMessage(messageText, messageId, speakBtn);
    actionsDiv.appendChild(speakBtn);

    actionsDiv.appendChild(regenerateBtn);

    return actionsDiv;
}

function copyToClipboard(text, messageId) {
    const cleanText = text.replace(/<[^>]*>/g, '');

    navigator.clipboard.writeText(cleanText).then(() => {
        showToast('Copied to clipboard!');

        const copyBtn = document.querySelector(`#${messageId}`).parentElement.querySelector('.copy-btn');
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="bx bx-check" title="Copied"></i>';
        copyBtn.classList.add('copied');

        setTimeout(() => {
            copyBtn.innerHTML = originalHTML;
            copyBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        showToast('Failed to copy message');
    });
}

function shareMessage(text) {
    const cleanText = text.replace(/<[^>]*>/g, '');

    if (navigator.share) {
        navigator.share({
            title: 'Chatterbox Response',
            text: cleanText,
            url: window.location.href
        }).then(() => {
            showToast('Shared successfully!');
        }).catch(err => {
            fallbackShare(cleanText);
        });
    } else {
        fallbackShare(cleanText);
    }
}

function fallbackShare(text) {
    const cleanText = text.replace(/<[^>]*>/g, '');
    if (navigator.clipboard) {
        navigator.clipboard.writeText(cleanText).then(() => {
            showToast('Message copied for sharing!');
        });
    } else {
        const textArea = document.createElement('textarea');
        textArea.value = cleanText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Message copied!');
    }
}

function downloadMessage(text) {
    const cleanText = text.replace(/<[^>]*>/g, '');
    const blob = new Blob([cleanText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatterbox-response-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download started!');
}

function showTranslationOptions(event, text, messageId) {
    const existingDropdowns = document.querySelectorAll('.translation-dropdown');
    existingDropdowns.forEach(dropdown => dropdown.remove());

    const cleanText = text.replace(/<[^>]*>/g, '');
    const dropdown = document.createElement('div');
    dropdown.className = 'translation-dropdown';

    const languages = [
        { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
        { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
        { code: 'te', name: 'Telugu', flag: '🇮🇳' },
        { code: 'fr', name: 'French', flag: '🇫🇷' },
        { code: 'es', name: 'Spanish', flag: '🇪🇸' },
        { code: 'de', name: 'German', flag: '🇩🇪' },
        { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
        { code: 'ko', name: 'Korean', flag: '🇰🇷' },
        { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
        { code: 'ru', name: 'Russian', flag: '🇷🇺' },
        { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
        { code: 'pt', name: 'Portuguese', flag: '🇵🇹' }
    ];

    languages.forEach(lang => {
        const option = document.createElement('div');
        option.className = 'translation-option';
        option.innerHTML = `
            <span style="width: 20px; text-align: center;">${lang.flag}</span>
            <span>${lang.name}</span>
        `;
        option.onclick = () => {
            dropdown.querySelectorAll('.translation-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');
            translateText(cleanText, lang.code, lang.name, messageId);
        };
        dropdown.appendChild(option);
    });

    const rect = event.target.getBoundingClientRect();
    const dropdownHeight = 300;
    const viewportHeight = window.innerHeight;


    let topPosition;
    if (rect.top > dropdownHeight + 50) {

        topPosition = rect.top - dropdownHeight - 10;
    } else {

        topPosition = rect.bottom + 10;
    }

    dropdown.style.position = 'fixed';
    dropdown.style.top = `${topPosition}px`;
    dropdown.style.left = `${rect.left}px`;

    document.body.appendChild(dropdown);

    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== event.target) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeDropdown);
    }, 100);
}

async function translateText(text, targetLang, langName, messageId) {
    const messageEl = document.getElementById(messageId);
    let translateBtn = null;
    let originalIcon = '';

    if (messageEl) {
        const chatLi = messageEl.closest('li');
        // Scope to .chat-actions to avoid finding the translation header icon
        const actionButtons = chatLi.querySelector('.chat-actions');
        if (actionButtons) {
            const icon = actionButtons.querySelector('.bx-translate, .bx-globe, .bx-globe-alt');
            if (icon) {
                translateBtn = icon.closest('button');
                originalIcon = translateBtn.innerHTML;
                translateBtn.innerHTML = '<i class="bx bx-loader-lines bx-spin bx-rotate-180"></i>';
                translateBtn.disabled = true;
            }
        }
    }

    try {
        showToast(`Translating to ${langName}...`);

        let translatedText = await tryMyMemoryTranslate(text, targetLang);
        if (!translatedText) translatedText = await tryGoogleTranslate(text, targetLang);

        if (translatedText) {
            showTranslationResult(translatedText, langName, messageId);
            showToast(`Translated to ${langName}!`);
        } else {
            throw new Error('All translation services failed');
        }

    } catch (error) {
        console.error(error);
        showToast('Translation failed. Please try again later.');
    } finally {
        if (translateBtn) {
            translateBtn.innerHTML = originalIcon;
            translateBtn.disabled = false;
        }
    }
}


async function tryMyMemoryTranslate(text, targetLang) {
    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
        const data = await response.json();
        if (data.responseStatus === 200) {
            return data.responseData.translatedText;
        }
    } catch (e) {
        console.log('MyMemory failed:', e.message);
    }
    return null;
}

async function tryGoogleTranslate(text, targetLang) {
    try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
        const data = await response.json();
        if (data && Array.isArray(data[0])) {
            return data[0].map(item => item[0]).join('');
        }
    } catch (e) {
        console.log('Google Translate failed:', e.message);
    }
    return null;
}

function showTranslationResult(translatedText, langName, messageId) {
    const existing = document.querySelector(`#${messageId}`).parentElement.querySelector('.translation-result');
    if (existing) existing.remove();

    const translationEl = document.createElement('div');
    translationEl.className = 'translation-result';

    function formatStreamedText(text) {

        // Temporary placeholder for think blocks to avoid regex conflicts during markdown parsing
        const thinkBlocks = [];
        let processedText = text.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
            thinkBlocks.push(content);
            return `__THINK_BLOCK_${thinkBlocks.length - 1}__`;
        });

        // Also handle incomplete/streaming think tag at the end
        const openThinkMatch = processedText.match(/<think>([\s\S]*)$/);
        if (openThinkMatch) {
            const content = openThinkMatch[1];
            thinkBlocks.push(content);
            processedText = processedText.replace(/<think>([\s\S]*)$/, `__THINK_BLOCK_${thinkBlocks.length - 1}__`);
        }

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
                // Allow pipes, colons, dashes (hyphen, en-dash, em-dash), and plus signs
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
                    rows.splice(1, 1);
                }
            }

            let html = '<table class="md-table"><thead><tr>';
            for (let i = 0; i < header.length; i++) {
                const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : '';
                html += `<th${align}>${header[i]}</th>`;
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

        text = escapeHTML(text)

            .replace(/^###### (.*$)/gim, '<h6>$1</h6>\n')
            .replace(/^##### (.*$)/gim, '<h5>$1</h5>\n')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>\n')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>\n')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>\n')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>\n')

            .replace(/\*\*\*(.*?)\*\*\*/gim, '<b><i>$1</i></b>')
            .replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*?)\*/gim, '<i>$1</i>')

            .replace(/`([^`]+)`/gim, '<code>$1</code>')

            .replace(/```(\w+)?\n?([\s\S]*?)```/gim, (match, lang, code) => {
                const language = lang ? ` class="language-${lang}"` : '';
                return `<pre><code${language}>${code}</code></pre>`;
            })

            .replace(/^\s*[-*]\s+(.*)/gim, '<li>$1</li>');

        const lines = text.split('\n');
        let html = '';
        let inList = false;
        let inTable = false;
        let tableLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            const pipeCount = (line.match(/\|/g) || []).length;
            const looksLikeTableRow =
                pipeCount >= 2 &&
                !/^<pre><code>/.test(line) &&
                !/<\/code><\/pre>/.test(line);

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
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
            }

            if (line.match(/<h[1-6]>/)) {
                html += `${line}<br>`;
                continue;
            }

            if (line.match(/^<pre><code>/)) {
                html += `${line}\n`;
                continue;
            }

            if (trimmed) {
                html += `<p style="background:rgba(255,255,255,0);">${line}</p>`;
            } else {
                html += `<br>`;
            }
        }

        if (inTable && tableLines.length) {
            html += createTableHTMLFromLines(tableLines);
        }

        if (inList) html += '</ul>';

        // Restore Math blocks
        html = html.replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => {
            const block = mathBlocks[index];
            if (!block) return match;
            try {
                return katex.renderToString(block.content, {
                    displayMode: true,
                    throwOnError: false
                });
            } catch (e) {
                return match;
            }
        });

        html = html.replace(/__MATH_INLINE_(\d+)__/g, (match, index) => {
            const block = mathBlocks[index];
            if (!block) return match;
            try {
                return katex.renderToString(block.content, {
                    displayMode: false,
                    throwOnError: false
                });
            } catch (e) {
                return match;
            }
        });

        return html;
    }

    const formattedText = formatTranslatedText(translatedText);

    translationEl.innerHTML = `
        <div class="translation-header">
            <i class='bx  bx-translate'></i> 
            <span>${langName} </span>
        </div>
        <div class="translation-content">${formattedText}</div>
    `;

    const messageEl = document.getElementById(messageId);
    messageEl.parentNode.insertBefore(translationEl, messageEl.nextSibling);
    translationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function regenerateResponse(messageId, originalMessage) {
    try {
        showToast('Regenerating response...');

        const messageElement = document.getElementById(messageId);
        const chatLi = messageElement.closest('.chat.incoming');

        const newIncomingChatli = createList('<span class="material-symbols-outlined"><img src="assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");

        chatLi.parentNode.replaceChild(newIncomingChatli, chatLi);

        chatbox.scrollTo(0, chatbox.scrollHeight);

        userMessage = originalMessage;
        await generateResponse(newIncomingChatli);

    } catch (error) {
        showToast('Failed to regenerate response');
    }
}

let currentSpeech = null;
let currentUtterance = null;
let synthesis = window.speechSynthesis;

// Settings Logic
const settingsModal = document.getElementById('settings-modal');
const settingsTabs = document.querySelectorAll('.settings-tab-btn');
const settingsContents = document.querySelectorAll('.settings-tab-content');
const voiceSelect = document.getElementById('voice-select');
const testVoiceBtn = document.getElementById('test-voice-btn');
const saveVoiceBtn = document.getElementById('save-voice-btn');
let voices = [];
let preferredVoiceName = localStorage.getItem('chat_preferred_voice');

// Initialize Settings
function initSettings() {
    // Tab Switching
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsContents.forEach(c => c.classList.remove('active'));

            // Add active
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // Voice Loading
    loadVoices();
    if (synthesis.onvoiceschanged !== undefined) {
        synthesis.onvoiceschanged = loadVoices;
    }



    // Settings Modal Save
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const gender = document.getElementById('user-gender').value;
            const ageGroup = document.getElementById('user-age').value;
            const language = document.getElementById('user-language').value;
            const culture = document.getElementById('user-culture').value;

            saveUserPreferences({ gender, ageGroup, language, culture });
            document.getElementById('settings-modal').style.display = 'none';
        });
    }

    // Custom Dropdown Logic
    const voiceWrapper = document.getElementById('voice-wrapper');
    const voiceTrigger = document.getElementById('voice-trigger');
    const voiceOptions = document.getElementById('voice-options');

    if (voiceWrapper && voiceTrigger) {
        voiceTrigger.addEventListener('click', () => {
            voiceWrapper.classList.toggle('open');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!voiceWrapper.contains(e.target)) {
                voiceWrapper.classList.remove('open');
            }
        });
    }

    // Save Voice
    if (saveVoiceBtn) {
        saveVoiceBtn.addEventListener('click', () => {
            const selectedOption = voiceOptions.querySelector('.voice-option.selected');
            if (selectedOption) {
                preferredVoiceName = selectedOption.getAttribute('data-value');
                localStorage.setItem('chat_preferred_voice', preferredVoiceName);
                saveUserPreferences({ voice: preferredVoiceName });
            }
        });
    }

    // Test Voice
    if (testVoiceBtn) {
        testVoiceBtn.addEventListener('click', () => {
            const testText = "Hello! This is how I sound.";
            speakTextSimple(testText);
        });
    }
}

function loadVoices() {
    voices = synthesis.getVoices();
    const voiceOptionsContainer = document.getElementById('voice-options');
    if (!voiceOptionsContainer) return;

    voiceOptionsContainer.innerHTML = '';

    // Filter Voices: Tamil, Telugu, Malayalam, English (IN), English (US)
    // Note: Codes might be ta-IN, te-IN, ml-IN, en-IN, en-US.
    const allowedLangs = ['ta-IN', 'ta', 'te-IN', 'te', 'ml-IN', 'ml', 'en-IN', 'en-US', 'en-GB'];

    // Filter and Deduplicate (sometimes multiple variants exist)
    const filteredVoices = voices.filter(voice => {
        // Check if lang starts with allowed codes (handling locale variants)
        // Normalize voice.lang: replace '_' with '-' and lower case
        const voiceLang = voice.lang.replace('_', '-');
        return allowedLangs.some(lang => voiceLang.includes(lang));
    });

    if (filteredVoices.length === 0) {
        voiceOptionsContainer.innerHTML = '<div class="voice-option" style="cursor: default;">No compatible voices found</div>';
        return;
    }

    // Sort to group by language
    filteredVoices.sort((a, b) => a.lang.localeCompare(b.lang));

    filteredVoices.forEach(voice => {
        const option = document.createElement('div');
        option.className = 'voice-option';
        option.textContent = `${voice.name} (${voice.lang})`;
        option.setAttribute('data-value', voice.name);

        if (voice.name === preferredVoiceName) {
            option.classList.add('selected');
            document.getElementById('voice-display').textContent = voice.name;
        }

        option.addEventListener('click', () => {
            // visual selection
            voiceOptionsContainer.querySelectorAll('.voice-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Update display
            document.getElementById('voice-display').textContent = voice.name;

            // Update preferredVoiceName immediately for testing (preview)
            // But don't save to localStorage/DB until Save button is clicked
            preferredVoiceName = voice.name;

            // Close dropdown
            document.getElementById('voice-wrapper').classList.remove('open');
        });

        voiceOptionsContainer.appendChild(option);
    });
}

// Call initSettings when DOM matches
if (document.getElementById('save-voice-btn')) {
    initSettings();
} else {
    // Retry if loaded too early
    setTimeout(() => {
        if (document.getElementById('save-voice-btn')) initSettings();
    }, 1000);
}

// --- Custom Model Dropdown Logic ---
function initModelDropdown() {
    const modelWrapper = document.getElementById('model-wrapper');
    const modelTrigger = document.getElementById('model-trigger');
    const modelOptions = document.getElementById('model-options');
    const modelSelectInput = document.getElementById('model-select');
    const modelDisplay = document.getElementById('model-display');

    if (modelWrapper && modelTrigger && modelOptions) {
        modelTrigger.addEventListener('click', () => {
            modelWrapper.classList.toggle('open');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!modelWrapper.contains(e.target)) {
                modelWrapper.classList.remove('open');
            }
        });

        // Option click handlers
        const options = modelOptions.querySelectorAll('.model-option');
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected from others
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // Update display and hidden input
                const value = option.getAttribute('data-value');
                const text = option.textContent; // Or use title if preferred for display
                // For display, maybe just the name part? Let's use text content.
                // Text content includes tooltip in original? No, title attribute is tooltip.
                // inner text is "Claude Sonnet 4" etc.

                modelDisplay.textContent = text;
                modelSelectInput.value = value;

                // Close dropdown
                modelWrapper.classList.remove('open');
            });
        });
    }
}

// Call init functions
if (document.readyState === 'complete') {
    // Already loaded
}

// Append to init sequence or call if elements exist
// We can hook this into init() if possible, or just call it here if script runs after body.
// Script is at bottom?
// Let's add it to init() or existing DOMContentLoaded listener.
// Search for initSettings usage. It's called when 'save-voice-btn' exists.
// Let's make a new initUI function or just append this logic.

// Since I am replacing content, I can just define it and call it.
initModelDropdown();

// --- Persistence Helpers ---
async function loadUserPreferences(email) {
    if (!email) return;
    try {
        const response = await fetch(`http://localhost:3000/user/preferences/${email}`);
        if (response.ok) {
            const prefs = await response.json();
            applyUserPreferences(prefs);
        }
    } catch (e) {
        console.error("Failed to load prefs", e);
    }
}

function applyUserPreferences(prefs) {
    // Theme
    if (prefs.theme) {
        const isWhite = prefs.theme === 'white';
        // Only toggle if different
        const currentWhite = document.body.classList.contains('white-mode');
        if (isWhite !== currentWhite) {
            document.body.classList.toggle('white-mode', isWhite);
        }

        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = isWhite;
            document.getElementById('theme-status').textContent = isWhite ? 'White Mode' : 'Dark Mode';
        }
    }

    // Voice
    if (prefs.voice) {
        preferredVoiceName = prefs.voice;
        localStorage.setItem('chat_preferred_voice', prefs.voice);
        const voiceDisplay = document.getElementById('voice-display');
        if (voiceDisplay) voiceDisplay.textContent = prefs.voice;
    }

    // Settings Form Fields
    if (prefs.gender) {
        const genderInput = document.getElementById('user-gender');
        if (genderInput) genderInput.value = prefs.gender;
        const display = document.querySelector('#gender-wrapper .custom-select-trigger span');
        // Map value to text if needed, or simple display
        if (display) display.textContent = prefs.gender || "Prefer not to say";
    }
    // ... similarly for other fields if needed
}

async function saveUserPreferences(updates) {
    // Fallback: get from localStorage if available there from Login logic
    // or try getting text content of the element or global var
    let email = localStorage.getItem('chat_user_email');

    // If not in local storage (maybe legacy), try DOM
    if (!email) {
        email = document.getElementById('loggedUserEmail')?.textContent;
    }

    if (!email) return;

    try {
        await fetch('http://localhost:3000/user/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, ...updates })
        });
        showToast('Settings saved');
    } catch (e) {
        console.error("Failed to save prefs", e);
        showToast('Failed to save settings');
    }
}


function speakMessage(rawHtml, messageId, btn) {
    // If speaking same content, toggle off
    if (synthesis.speaking && currentSpeech === messageId) {
        synthesis.cancel();
        removeHighlight(messageId);
        if (btn) btn.innerHTML = '<i class="bx bx-volume-full" title="Listen"></i>';
        currentSpeech = null;
        return;
    }

    synthesis.cancel(); // Stop active speech

    // Cleanup previous highlights if different message
    document.querySelectorAll('.speaking-highlight').forEach(el => {
        el.outerHTML = el.innerHTML; // Remove partial wrappers
    });

    const messageEl = document.getElementById(messageId);
    if (!messageEl) return;

    // Use textContent for speech to match DOM TextNodes exactly for highlighting
    const textToSpeak = messageEl.textContent;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance = utterance;

    // Set Voice
    if (preferredVoiceName) {
        const chosenVoice = voices.find(v => v.name === preferredVoiceName);
        if (chosenVoice) utterance.voice = chosenVoice;
    }

    utterance.onstart = () => {
        if (btn) btn.innerHTML = '<i class="bx bx-stop" title="Stop"></i>';
        currentSpeech = messageId;
    };

    utterance.onend = () => {
        if (btn) btn.innerHTML = '<i class="bx bx-volume-full" title="Listen"></i>';
        currentSpeech = null;
        removeHighlight(messageId);
    };

    utterance.onerror = () => {
        if (btn) btn.innerHTML = '<i class="bx bx-volume-full" title="Listen"></i>';
        currentSpeech = null;
        removeHighlight(messageId);
        // showToast('Text-to-speech interrupted'); // Optional
    };

    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            highlightWord(messageEl, event.charIndex, event.charLength);
        }
    };

    synthesis.speak(utterance);
}

function speakTextSimple(text) {
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (preferredVoiceName) {
        const chosenVoice = voices.find(v => v.name === preferredVoiceName);
        if (chosenVoice) utterance.voice = chosenVoice;
    }
    synthesis.speak(utterance);
}

function highlightWord(rootEl, charIndex, charLength) {
    // Remove previous highlight within this root
    removeHighlight(rootEl.id);

    if (!rootEl) return;

    const treeWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);

    let currentCharCount = 0;
    let targetNode = null;
    let targetOffset = 0;

    // Find the text node containing the charIndex
    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode;
        const nodeLength = node.textContent.length;

        if (currentCharCount + nodeLength > charIndex) {
            targetNode = node;
            targetOffset = charIndex - currentCharCount;
            break;
        }
        currentCharCount += nodeLength;
    }

    if (targetNode) {
        // Check if word fits in this node, else it might span (ignoring span case for simplicity)
        // We will wrap the specific range
        const range = document.createRange();
        try {
            const endOffset = Math.min(targetOffset + charLength, targetNode.textContent.length);
            range.setStart(targetNode, targetOffset);
            range.setEnd(targetNode, endOffset);

            const mark = document.createElement('mark');
            mark.className = 'speaking-highlight';
            range.surroundContents(mark);
        } catch (e) {
            console.log('Highlight error', e);
        }
    }
}

function removeHighlight(rootId) {
    // Flatten any <mark> tags inside the root
    if (!rootId) return;
    const root = document.getElementById(rootId);
    if (!root) return;

    // Use querySelectorAll to find highlights specifically
    const highlights = root.querySelectorAll('.speaking-highlight');
    highlights.forEach(mark => {
        const parent = mark.parentNode;
        // Move children out
        while (mark.firstChild) {
            parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        // Normalize to merge text nodes
        parent.normalize();
    });
}

function showToast(message) {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

const createList = (message, className, isComplete = false) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    const messageID = "msg_" + Math.random().toString(36).substr(2, 9);

    let chatContent = '';

    if (className === "outgoing") {
        chatContent = `<p id="${messageID}" class="user-message">${message} </p>`;
    } else {
        chatContent = `<p id="${messageID}" class="chat-content">${message}</p>`;
    }

    chatLi.innerHTML = chatContent;

    if (className === "incoming") {
        const actionButtons = createActionButtons(messageID, message, isComplete);
        chatLi.appendChild(actionButtons);
    }

    return chatLi;
};
function formatStreamedText(text) {

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

    const escapeHTML = (str) =>
        String(str).replace(/[&<>"']/g, (tag) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag]
        ));

    function createTableHTMLFromLines(rows) {
        if (!rows || !rows.length) return '';

        const parse = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

        const header = parse(rows[0]);
        let alignments = new Array(header.length).fill(null);

        if (rows.length > 1) {
            const divider = rows[1].replace(/\s+/g, '');
            if (/^[:\-|]+$/.test(divider)) {
                const divCells = parse(rows[1]);
                alignments = divCells.map(cell => {
                    const left = cell.startsWith(':');
                    const right = cell.endsWith(':');
                    if (left && right) return 'center';
                    if (right) return 'right';
                    if (left) return 'left';
                    return null;
                });
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
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        .replace(/```(\w+)?\n?([\s\S]*?)```/gim, (match, lang, code) => {
            const language = lang ? ` class="language-${lang}"` : '';
            return `<pre><code${language}>${code}</code></pre>`;
        })
        .replace(/^\s*[-*]\s+(.*)/gim, '<li>$1</li>');

    const lines = processedText.split('\n');
    let html = '';
    let inList = false;
    let inTable = false;
    let tableLines = [];

    for (let line of lines) {
        const trimmed = line.trim();

        const pipeCount = (line.match(/\|/g) || []).length;
        const looksLikeTableRow = pipeCount >= 2 && !/^<pre><code>/.test(line) && !/<\/code><\/pre>/.test(line);

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
        } else if (line.trim() !== '') { // Only close list if line is NOT empty
            if (inList) {
                html += '</ul>';
                inList = false;
            }
        }

        if (line.match(/<h[1-6]/)) {
            html += `${line}`;
            continue;
        }

        if (line.match(/^<pre><code>/)) {
            html += `${line}\n`;
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

    if (inList) html += '</ul>';

    // Restore think blocks
    html = html.replace(/__THINK_BLOCK_(\d+)__/g, (match, index) => {
        const content = thinkBlocks[index] || "";
        return `
            <div class="think-block-wrapper">
                <details class="think-block-details">
                    <summary>Thinking Process</summary>
                    <div class="think-block-content">${escapeHTML(content)}</div>
                </details>
            </div>
        `;
    });

    // Restore Math blocks
    html = html.replace(/__MATH_BLOCK_(\d+)__/g, (match, index) => {
        const block = mathBlocks[index];
        if (!block) return match;
        try {
            return katex.renderToString(block.content, {
                displayMode: true,
                throwOnError: false
            });
        } catch (e) {
            return match;
        }
    });

    html = html.replace(/__MATH_INLINE_(\d+)__/g, (match, index) => {
        const block = mathBlocks[index];
        if (!block) return match;
        try {
            return katex.renderToString(block.content, {
                displayMode: false,
                throwOnError: false
            });
        } catch (e) {
            return match;
        }
    });

    return html;
}

let response;
let file = null;
async function generateResponse(incomingChatli) {
    const messageElement = incomingChatli.querySelector('p');
    try {
        const selectedModel = document.getElementById("model-select").value;

        const formData = new FormData();
        formData.append("message", userMessage);
        formData.append("model", selectedModel);

        const userEmail = localStorage.getItem('loggedInUserEmail');
        if (!userEmail) {
            showToast("Please login to send messages.");
            incomingChatli.remove();
            return;
        }
        formData.append("email", userEmail);

        if (currentSessionId) {
            formData.append("sessionId", currentSessionId);
        }

        if (isTemporaryMode) {
            formData.append("isTemporary", "true");
        }

        if (webSearch && webSearch.classList.contains("active")) {
            formData.append("webSearch", "true");
            const messages = [
                "Checking online sources...",
                "Looking around the web...",
                "Gathering insights for you...",
                "Summerizing the results..."
            ];

            let index = 0;

            function rotateMessage() {
                messageElement.innerHTML = `
                    <span class="search-message">
                    <i class="bx bx-globe-americas bx-tada bx-rotate-270"></i>
                    <span>${messages[index]}</span>
                    </span>
                    `;
                index = (index + 1) % messages.length;
            }

            setTimeout(() => {
                rotateMessage();
            }, 2000);


        }
        else {
            formData.append("webSearch", "false");
        }

        if (file) {
            formData.append("image", file);
        }

        // Add settings to formData
        const savedSettings = localStorage.getItem("chatSettings");
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.gender) formData.append('gender', settings.gender);
            if (settings.ageGroup) formData.append('ageGroup', settings.ageGroup);
            if (settings.language) formData.append('language', settings.language);
            if (settings.culture) formData.append('culture', settings.culture);
        }

        response = await fetch("http://localhost:3000/stream", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let fullText = "";
        let displayedText = "";
        let isStreaming = true;
        const animationSpeed = 50; // ms per character

        // Animation loop
        const animateText = () => {
            // Capture state of all think blocks in this message
            const openIndices = new Set();
            messageElement.querySelectorAll('details.think-block-details').forEach((el, index) => {
                if (el.hasAttribute('open')) openIndices.add(index);
            });

            if (displayedText.length < fullText.length) {
                // Calculate dynamic chunk size to catch up if buffer is large
                const bufferSize = fullText.length - displayedText.length;
                const chunkSize = Math.max(1, Math.min(bufferSize, Math.ceil(bufferSize / STREAMING_SPEED_MODIFIER) + 1)); // Adaptive speed

                displayedText += fullText.slice(displayedText.length, displayedText.length + chunkSize);

                let html = formatStreamedText(displayedText);

                // Restore open state
                let count = 0;
                html = html.replace(/<details class="think-block-details">/g, (match) => {
                    const isOpen = openIndices.has(count++);
                    return isOpen ? '<details class="think-block-details" open>' : match;
                });

                messageElement.innerHTML = html;
                chatbox.scrollTo(0, chatbox.scrollHeight);
                requestAnimationFrame(animateText); // No setTimeout delay, run at max frame rate
            } else if (!isStreaming) {
                let html = formatStreamedText(fullText);

                // Restore open state for final render
                let count = 0;
                html = html.replace(/<details class="think-block-details">/g, (match) => {
                    const isOpen = openIndices.has(count++);
                    return isOpen ? '<details class="think-block-details" open>' : match;
                });

                messageElement.innerHTML = html;
                chatbox.scrollTo(0, chatbox.scrollHeight);
                const actionButtons = incomingChatli.querySelector('.chat-actions');
                if (actionButtons) {
                    const newActionButtons = createActionButtons(messageElement.id, fullText, true);
                    actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                    newActionButtons.style.display = 'flex';
                }
            } else {
                requestAnimationFrame(animateText);
            }
        };
        animateText();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                isStreaming = false;
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n\n");

            for (const line of lines) {
                if (line.startsWith("event: session_id")) {
                    currentSessionId = line.split("\n")[1].replace("data: ", "").trim();
                    loadSessions();
                } else if (line.startsWith("event: sources")) {
                    const dataStr = line.split("\n")[1].replace("data: ", "").trim();
                    try {
                        const sources = JSON.parse(dataStr);
                        renderSources(sources, messageElement);
                    } catch (e) {
                        console.error("Error parsing sources", e);
                    }
                } else if (line.startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr === "done") break;

                    try {
                        const data = JSON.parse(dataStr);
                        if (data.text) {
                            fullText += data.text;
                        }
                        if (data.error) {
                            showToast("Error: " + data.error);
                            messageElement.innerHTML = `<span style="color: red;">Error: ${data.error}</span>`;
                            isStreaming = false;
                        }
                    } catch (e) {
                    }
                }
            }
        }

    }

    catch (error) {
        showToast('Error: ' + error.message);
        console.error(error);
        messageElement.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
    } finally {
        sendButton.style.display = "block";
        chatInput.value = "";
    }
}

function renderSources(sources, messageElement) {
    if (!sources || sources.length === 0) return;

    const sourcesDiv = document.createElement("div");
    sourcesDiv.className = "sources-container";

    const scrollContainer = document.createElement("div");
    scrollContainer.className = "sources-scroll-container";

    sources.forEach(source => {
        const sourceItem = document.createElement("a");
        sourceItem.href = source.link;
        sourceItem.target = "_blank";
        sourceItem.className = "source-item";
        sourceItem.title = source.title;

        try {
            const url = new URL(source.link);
            const domain = url.hostname;
            const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

            sourceItem.innerHTML = `
                <div class="source-logo-container">
                    <img src="${faviconUrl}" alt="${domain}" onerror="this.src='assests/globe.png'">
                </div>
                <div class="source-info">
                    <span class="source-title">${source.title}</span>
                    <span class="source-domain">${domain}</span>
                </div>
            `;
        } catch (e) {
            console.error("Invalid URL:", source.link);
            sourceItem.innerHTML = `
                <div class="source-logo-container">
                    <i class='bx bx-globe'></i>
                </div>
                <div class="source-info">
                    <span class="source-title">${source.title}</span>
                </div>
            `;
        }

        scrollContainer.appendChild(sourceItem);
    });

    sourcesDiv.appendChild(scrollContainer);

    messageElement.parentNode.insertBefore(sourcesDiv, messageElement);
}

function ChatHandle() {

    userMessage = chatInput.value.trim();
    if (!userMessage) {
        const randomIndex = Math.floor(Math.random() * alertMessages.length);
        showToast(alertMessages[randomIndex]);
        return;
    }

    sendButton.style.display = "none";
    hometagContent.style.display = "none";
    document.getElementById("chat-input").classList.add("hide-before");
    chatbox.appendChild(createList(userMessage, "outgoing"));

    chatInput.value = "";
    chatbox.scrollTo(0, chatbox.scrollHeight);

    setTimeout(() => {
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming")
        chatbox.appendChild(incomingChatli);
        generateResponse(incomingChatli);
    }, 600);

}

chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ChatHandle();
    }
});

sendButton.addEventListener("click", ChatHandle);



async function loadSessions() {
    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (!userEmail) return;

    try {
        const res = await fetch(`http://localhost:3000/sessions/${userEmail}`);
        const sessions = await res.json();

        const list = document.getElementById("chat-history-list");
        list.innerHTML = "";

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {
            "Today": [],
            "Yesterday": [],
            "Previous 7 Days": [],
            "Previous 30 Days": [],
            "Older": []
        };

        sessions.forEach(session => {
            const date = new Date(session.updatedAt);
            const diffTime = Math.abs(today - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (date.toDateString() === today.toDateString()) {
                groups["Today"].push(session);
            } else if (date.toDateString() === yesterday.toDateString()) {
                groups["Yesterday"].push(session);
            } else if (diffDays <= 7) {
                groups["Previous 7 Days"].push(session);
            } else if (diffDays <= 30) {
                groups["Previous 30 Days"].push(session);
            } else {
                groups["Older"].push(session);
            }
        });

        for (const [key, group] of Object.entries(groups)) {
            if (group.length > 0) {
                const header = document.createElement("li");
                header.className = "history-header";
                header.textContent = key;
                list.appendChild(header);

                group.forEach(session => {
                    const li = document.createElement("li");
                    li.className = `history-item ${session._id === currentSessionId ? 'active' : ''}`;
                    li.id = `session-${session._id}`;

                    li.innerHTML = `
                        <i class='bx bx-message-square-detail'></i>
                        <span class="session-title" onclick="loadSession('${session._id}')">${session.title}</span>
                        <button class="delete-session-btn" onclick="deleteSession('${session._id}')" title="Delete Chat">
                            <i class='bx bx-trash'></i>
                        </button>
                    `;
                    list.appendChild(li);
                });
            }
        }

    } catch (error) {
        console.error("Failed to load sessions", error);
    }
}



async function deleteSession(sessionId) {
    if (event) event.stopPropagation();

    const confirmed = await showDeleteConfirmation();
    if (!confirmed) return;

    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (!userEmail) {
        showToast("Please login to delete chats");
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/sessions/${userEmail}/${sessionId}/soft-delete`, {
            method: 'PATCH'
        });

        if (res.ok) {
            showToast("Chat deleted");
            if (currentSessionId === sessionId) {
                startNewChat();
            } else {
                loadSessions();
            }
        } else {
            showToast("Failed to delete chat");
        }
    } catch (error) {
        console.error("Error deleting session:", error);
        showToast("Error deleting chat");
    }
}

function showDeleteConfirmation() {
    return new Promise((resolve) => {
        const modal = document.getElementById('delete-confirm-modal');
        const cancelBtn = document.getElementById('confirm-cancel');
        const deleteBtn = document.getElementById('confirm-delete');

        modal.classList.add('show');

        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(false);
        };

        const handleDelete = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(true);
        };


        const handleOutsideClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };


        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };

        cancelBtn.addEventListener('click', handleCancel);
        deleteBtn.addEventListener('click', handleDelete);
        modal.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        function cleanup() {
            cancelBtn.removeEventListener('click', handleCancel);
            deleteBtn.removeEventListener('click', handleDelete);
            modal.removeEventListener('click', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        }
    });
}



async function loadSession(sessionId) {
    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (!userEmail) return;

    try {
        const res = await fetch(`http://localhost:3000/session/${userEmail}/${sessionId}`);
        if (!res.ok) throw new Error("Failed to fetch session");
        const session = await res.json();

        currentSessionId = sessionId;

        document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));
        loadSessions();

        chatbox.innerHTML = "";
        hometagContent.style.display = "none";
        document.getElementById("chat-input").classList.add("hide-before");

        if (session.messages && Array.isArray(session.messages)) {
            session.messages.forEach(msg => {
                if (!msg.parts || msg.parts.length === 0) return;

                if (msg.role === "user") {
                    const webScrapedPart = msg.parts.find(p => p.text && p.text.startsWith("Web-Scraped-Data"));
                    if (webScrapedPart) {
                        try {
                            const data = JSON.parse(webScrapedPart.text.replace("Web-Scraped-Data: ", ""));
                            const sources = (data.results || []).map(r => ({ title: r.title, link: r.link }));
                            // Render sources container if needed, logic preserved from original but safer
                        } catch (e) {
                            console.error("Error parsing stored web data", e);
                        }
                    }

                    const textPart = msg.parts.find(p => p.text && !p.text.startsWith("System-Time") && !p.text.startsWith("Web-Scraped-Data")) || msg.parts[0];
                    const text = textPart ? textPart.text : "";

                    if (text && !text.startsWith("Web-Scraped-Data")) {
                        const li = createList(text, "outgoing");
                        chatbox.appendChild(li);

                        // Re-render sources if they exist (rendering logic could be improved but keeping minimal changes to fix crash)
                        if (webScrapedPart) {
                            try {
                                const data = JSON.parse(webScrapedPart.text.replace("Web-Scraped-Data: ", ""));
                                const sources = (data.results || []).map(r => ({ title: r.title, link: r.link }));
                                if (sources.length > 0) {
                                    const messageP = li.querySelector('p');
                                    renderSources(sources, messageP);
                                }
                            } catch (e) { }
                        }
                    }

                } else {
                    const textPart = msg.parts.find(p => p.text && !p.text.startsWith("System-Time")) || msg.parts[0];
                    const text = textPart ? textPart.text : "";
                    if (text) {
                        const li = createList(text, "incoming", true);
                        li.querySelector("p").innerHTML = formatStreamedText(text);
                        chatbox.appendChild(li);
                    }
                }
            });
        }

        chatbox.scrollTo(0, chatbox.scrollHeight);

        if (window.innerWidth <= 768) {
            sidebar.classList.remove("open");
        }

    } catch (error) {
        console.error("Failed to load session", error);
        showToast("Failed to load chat session");
    }
}

const greetings = [
    "How can I assist you today?",
    "What brings you here?",
    "Need a hand with something?",
    "How may I help?",
    "Ready to get started?",
    "What can I do for you?",
    "How can I support you today?",
    "What’s on your mind?",
    "How can I help this time?",
    "What do you need today?"
];

function setRandomGreeting() {
    const greetTag = document.getElementById("Greet-tag");
    if (greetTag) {
        const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
        greetTag.textContent = randomGreeting;
    }
}

function startNewChat() {
    currentSessionId = null;
    chatbox.innerHTML = "";
    hometagContent.style.display = "block";
    document.getElementById("chat-input").classList.remove("hide-before");
    setRandomGreeting(); // Set random greeting
    loadSessions();
}










const micBtn = document.getElementById('mic-btn');
const startSound = document.getElementById('startSound');
const stopSound = document.getElementById('stopSound');
const fileUpload = document.getElementById('file-upload');
const filePreview = document.getElementById('file-preview');
const fileName = document.getElementById('file-name');
const cancelFile = document.querySelector('.cancel-file');
const webSearch = document.getElementById('web-search');
const textarea = document.getElementById('inputa');


micBtn.addEventListener('click', () => {
    micBtn.classList.toggle('recording');
    const isRecording = micBtn.classList.contains('recording');
    micBtn.innerHTML = `<i class='bx ${isRecording ? 'bx-pause' : 'bx-microphone'}'></i>`;
    micBtn.title = isRecording ? 'Stop recording' : 'Start speaking';
    (isRecording ? startSound : stopSound).play();
});


fileUpload.addEventListener("change", (event) => {
    file = event.target.files[0];
    if (!file) return;
    webSearch.style.display = 'none';
    fileName.textContent = file.name;
    filePreview.classList.remove("hidden");
});



cancelFile.addEventListener('click', () => {
    file = null;
    webSearch.style.display = 'flex';
    fileUpload.value = '';
    filePreview.classList.add('hidden');
});


webSearch.addEventListener('click', () => {
    webSearch.classList.toggle('active');
});


const resizetextarea = document.querySelector('.chat-input textarea');
const maxHeight = 145;
const defaultHeight = 45;
resizetextarea.addEventListener('input', () => {
    resizetextarea.style.height = defaultHeight + 'px';
    resizetextarea.style.height = Math.min(resizetextarea.scrollHeight, maxHeight) + 'px';
});





textarea.addEventListener("focus", () => {
    chatInput.classList.add("active");
});

textarea.addEventListener("blur", () => {
    chatInput.classList.remove("active");
});


const phrases = [
    "Hey there! What’s on your mind?",
    "Share a thought, I’m listening 😊",
    "Type something magical… ✨",
    "Let’s chat! I’m all ears 👂",
    "Say hello to your AI buddy!",
    "Drop a message, don’t be shy!",
    "Feeling curious? Type it out!",
    "Got a question? Ask away!",
    "Start typing — I’ve got you!",
    "Tell me something fun!",
    "Your thoughts go here 💬",
    "Let’s make something awesome!",
    "Whisper your idea to me…",
    "Ready when you are!",
    "Let the conversation begin!",
    "I’m here for your words 💡",
    "Type freely — no judgment!",
    "Let’s explore together 🌍",
    "What’s on your mind? 😊",
    "Type anything — I’m listening! 🧠💬",
    "Feeling curious? Let’s explore! 🔍✨",
    "Your words matter. 📝❤️",
    "Let’s chat anytime! 🤗💬",
    "Got a question? Ask away! 💡👂",
    "Let it flow — I’m here. 🌊🧘",
    "Say hi or share a story! 👋📖",
    "This space is all yours. 🌈🗣️",
    "Let’s create something great! 🚀✨"
];

textarea.addEventListener("input", () => {
    if (textarea.value === "") {
        const random = phrases[Math.floor(Math.random() * phrases.length)];
        textarea.placeholder = random;
    }
});

function saveSettings(e) {
    if (e) e.preventDefault();
    const gender = document.getElementById("user-gender").value;
    const ageGroup = document.getElementById("user-age").value;
    const language = document.getElementById("user-language").value;
    const culture = document.getElementById("user-culture").value;

    const settings = {
        gender,
        ageGroup,
        language,
        culture
    };

    localStorage.setItem("chatSettings", JSON.stringify(settings));
    document.getElementById("settings-modal").classList.remove("show");
    showToast("Preferences saved!");
}

// Load Settings
function loadSettings() {
    const savedSettings = localStorage.getItem("chatSettings");
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        // Load Gender
        if (settings.gender !== undefined) {
            const genderWrapper = document.getElementById('gender-wrapper');
            const input = document.getElementById('user-gender');
            const display = document.getElementById('gender-display');

            if (genderWrapper && input && display) {
                input.value = settings.gender;
                const options = genderWrapper.querySelectorAll('.custom-option');
                options.forEach(opt => {
                    if (opt.getAttribute('data-value') === settings.gender) {
                        display.textContent = opt.textContent;
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });
            }
        }

        // Load Age
        if (settings.ageGroup !== undefined) {
            const ageWrapper = document.getElementById('age-wrapper');
            const input = document.getElementById('user-age');
            const display = document.getElementById('age-display');

            if (ageWrapper && input && display) {
                input.value = settings.ageGroup;
                const options = ageWrapper.querySelectorAll('.custom-option');
                options.forEach(opt => {
                    if (opt.getAttribute('data-value') === settings.ageGroup) {
                        display.textContent = opt.textContent;
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });
            }
        }

        if (settings.language) {
            const langInput = document.getElementById("user-language");
            if (langInput) langInput.value = settings.language;
        }

        if (settings.culture) {
            const cultureInput = document.getElementById("user-culture");
            if (cultureInput) cultureInput.value = settings.culture;
        }
    }
}
window.loadSession = loadSession;
window.deleteSession = deleteSession;



document.addEventListener("DOMContentLoaded", () => {

    const settingsModal = document.getElementById("settings-modal");
    const settingsBtn = document.getElementById("settings-btn");
    const closeSettingsBtn = document.getElementById("close-settings");

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener("click", (e) => {
            e.preventDefault();
            loadSettings(); // Load saved values
            settingsModal.classList.add("show");
        });
    }

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", saveSettings);
    }

    if (closeSettingsBtn && settingsModal) {
        closeSettingsBtn.addEventListener("click", () => {
            settingsModal.classList.remove("show");
        });
    }


    const customSelects = document.querySelectorAll('.custom-select-wrapper');

    customSelects.forEach(select => {
        const trigger = select.querySelector('.custom-select-trigger');
        const hiddenInput = select.querySelector('input[type="hidden"]');
        const displaySpan = select.querySelector('span');

        if (trigger) {

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();

                customSelects.forEach(otherSelect => {
                    if (otherSelect !== select) {
                        otherSelect.classList.remove('open');
                    }
                });
                select.classList.toggle('open');
            });
        }

        if (select) {

            select.querySelectorAll('.custom-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const value = option.getAttribute('data-value');
                    const text = option.textContent;


                    if (hiddenInput) hiddenInput.value = value;
                    if (displaySpan) displaySpan.textContent = text;


                    select.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');


                    select.classList.remove('open');
                });
            });
        }
    });


    window.addEventListener("click", (e) => {

        if (settingsModal && e.target === settingsModal) {
            settingsModal.classList.remove("show");
        }


        if (!e.target.closest('.custom-select-wrapper')) {
            customSelects.forEach(select => select.classList.remove('open'));
        }
    });


    const shareBtn = document.querySelector(".right-heder-bar .bx-share");
    const tempChatBtn = document.querySelector(".right-heder-bar .bxs-message-bubble-notification");

    if (tempChatBtn) {
        tempChatBtn.addEventListener("click", () => {
            isTemporaryMode = !isTemporaryMode;
            if (isTemporaryMode) {
                showToast("Temporary Chat Enabled");
                tempChatBtn.style.color = "#ff4444"; // Visual indicator
                startNewChat(); // content clear
            } else {
                showToast("Temporary Chat Disabled");
                tempChatBtn.style.color = "#fff"; // Revert color
                startNewChat();
            }
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener("click", async () => {
            if (!currentSessionId) {
                showToast("No active session to share.");
                return;
            }

            const userEmail = localStorage.getItem('loggedInUserEmail');
            if (!userEmail) {
                showToast("Please login to share.");
                return;
            }

            try {
                showToast("Generating share link...");
                const res = await fetch("http://localhost:3000/share", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: userEmail, sessionId: currentSessionId })
                });

                if (!res.ok) throw new Error("Failed to share");

                const data = await res.json();
                const shareUrl = `${window.location.origin}/share.html?id=${data.shareId}`;

                navigator.clipboard.writeText(shareUrl).then(() => {
                    showToast("Share link copied to clipboard!");
                });

            } catch (error) {
                console.error(error);
                showToast("Error sharing session.");
            }
        });
    }
});
