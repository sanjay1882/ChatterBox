// Set API_BASE_URL directly to bypass import issues in some environments
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname === ''
    ? "http://localhost:3000"
    : "https://chatterbox-backend-3tlejwqmcq-uc.a.run.app";

let chatInput = document.querySelector(".chat-input textarea");
const chatbox = document.querySelector(".chatbox");
const hometagContent = document.getElementById("home-tag-contentID");



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

async function getAuthToken() {
    if (window.auth && window.auth.currentUser) {
        try {
            return await window.auth.currentUser.getIdToken();
        } catch (e) {
            console.error("Error getting auth token", e);
        }
    }
    return null;
}

let userMessage;
let currentSessionId = null;
let allSessions = [];
// let userMessage; // Removed duplicate
// let currentSessionId = null; // Removed duplicate
// let allSessions = []; // Removed duplicate

let isTemporaryMode = false;
let isImageGenMode = false;
let abortController = null; // Controller for stopping generation
let stopDisplayFlag = false; // Stops visual streaming display without killing network

// Gallery State
let currentGalleryPage = 1;
let galleryImagesCache = [];
let galleryHasNextPage = false;
let isGalleryLoading = false;

// Session State
let currentSessionPage = 1;
let sessionsCache = [];
let sessionsHasNextPage = false;
let isSessionsLoading = false;

function getCurrentUserEmail() {
    if (window.auth && window.auth.currentUser && window.auth.currentUser.email) {
        return window.auth.currentUser.email;
    }
    return localStorage.getItem('loggedInUserEmail');
}

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

    // Wait for Auth to Initialize BEFORE fetching data
    const waitForAuth = () => {
        return new Promise((resolve) => {
            if (window.auth && window.onAuthStateChanged) {
                const unsubscribe = window.onAuthStateChanged(window.auth, (user) => {
                    unsubscribe(); // Unsubscribe immediately, we just needed the first event
                    resolve(user);
                });
            } else {
                // If firebasescripts aren't loaded yet (unlikely with order, but safe)
                setTimeout(() => resolve(null), 2000);
            }
        });
    };

    waitForAuth().then((user) => {
        const profileLi = document.getElementById('profile-li');
        const loginLi = document.getElementById('login-li');

        if (!user) {
            // Guest mode logic
            if (profileLi) profileLi.style.display = 'none';
            if (loginLi) loginLi.style.display = 'block';
            return;
        }

        // Logged in mode
        if (profileLi) profileLi.style.display = 'flex'; // Use flex as per css usually
        if (loginLi) loginLi.style.display = 'none';

        // Ensure email in localStorage matches the authenticated user
        const storedEmail = localStorage.getItem('loggedInUserEmail');
        if (user.email && user.email !== storedEmail) {
            localStorage.setItem('loggedInUserEmail', user.email);
        }

        const emailToUse = user.email || storedEmail;


        if (emailToUse) {
            loadUserPreferences(emailToUse);
            loadSessions(true);
        }
        initSettings();
    });
}

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

        saveUserPreferences({ theme: mode });
    });
}

const shareChatBtn = document.querySelector(".bx-forward-big");
if (shareChatBtn) {
    shareChatBtn.addEventListener('click', shareChatSession);
}

const galleryBtn = document.getElementById('gallery-btn');
if (galleryBtn) {
    galleryBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Always prevent default anchor behavior
        if (!checkGuestAccess('gallery')) {
            return;
        }
        const galleryModal = document.getElementById('gallery-modal');
        if (galleryModal) {
            galleryModal.classList.add('show');
            // If cache is empty, load first page. If not, it will show cached images instantly
            if (galleryImagesCache.length === 0) {
                loadGalleryImages(true);
            } else {
                renderGalleryImages(galleryImagesCache);
                // Optionally refresh cache in background or keep as is for "production level" speed
            }
        }
    });

    const closeGallery = document.getElementById('close-gallery');
    if (closeGallery) {
        closeGallery.addEventListener('click', () => {
            document.getElementById('gallery-modal').classList.remove('show');
        });
    }
}

async function loadGalleryImages(isFirstPage = false) {
    if (isGalleryLoading) return;

    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    if (isFirstPage) {
        currentGalleryPage = 1;
        galleryImagesCache = [];
        grid.innerHTML = Array(12).fill('<div class="gallery-skeleton-item"></div>').join('');
    }

    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (!userEmail) return;

    isGalleryLoading = true;

    try {
        const token = await getAuthToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            console.warn("Gallery fetch: No auth token available. Request may fail 401.");
        }

        const limit = 12;
        console.log(`Fetching gallery: Page ${currentGalleryPage}, Limit ${limit}`);
        const res = await fetch(`${API_BASE_URL}/user/gallery/${userEmail}?page=${currentGalleryPage}&limit=${limit}`, { headers });

        if (res.ok) {
            const data = await res.json();
            const images = data.images || [];
            galleryHasNextPage = data.hasNextPage;

            console.log(`Gallery fetch success: Received ${images.length} images`);

            if (isFirstPage && images.length === 0) {
                grid.innerHTML = '<div class="gallery-empty">no photos found</div>';
                isGalleryLoading = false;
                return;
            }

            // Update cache
            galleryImagesCache = [...galleryImagesCache, ...images];

            renderGalleryImages(galleryImagesCache);
            updateLoadMoreButton();

            if (galleryHasNextPage) {
                currentGalleryPage++;
            }
        } else {
            console.error(`Gallery fetch failed: Status ${res.status}`);
            if (res.status === 401) {
                showToast("Authentication failed. Please try logging in again.");
            }
            if (isFirstPage) grid.innerHTML = '<div class="gallery-error">Failed to load images.</div>';
        }
    } catch (e) {
        console.error("Gallery load error", e);
        if (isFirstPage) grid.innerHTML = '<div class="gallery-error">Error loading images.</div>';
    } finally {
        isGalleryLoading = false;
    }
}

function renderGalleryImages(images) {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    grid.innerHTML = '';
    images.forEach(imgData => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        div.innerHTML = `<img src="data:${imgData.mimeType || 'image/png'};base64,${imgData.imageBase64}" alt="Generated Image" loading="lazy">`;
        div.onclick = () => openImageModal(`data:${imgData.mimeType || 'image/png'};base64,${imgData.imageBase64}`, imgData.prompt || "Gallery Image");
        grid.appendChild(div);
    });
}

function updateLoadMoreButton() {
    let loadMoreBtn = document.getElementById('gallery-load-more');
    const galleryBody = document.querySelector('.gallery-body');

    if (galleryHasNextPage) {
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'gallery-load-more';
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.innerHTML = '<span>Load More</span> <i class="bx bx-chevron-down"></i>';
            loadMoreBtn.onclick = () => loadGalleryImages();
            galleryBody.appendChild(loadMoreBtn);
        }
        loadMoreBtn.style.display = 'flex';
    } else if (loadMoreBtn) {
        loadMoreBtn.style.display = 'none';
    }
}


const generateImageBtn = document.getElementById('generate-image-btn');
if (generateImageBtn) {
    generateImageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!checkGuestAccess('image')) return;
        isImageGenMode = !isImageGenMode;
        if (isImageGenMode) {
            generateImageBtn.classList.add('active');
            chatInput.placeholder = "Describe image to generate...";
            actionsMenu.classList.remove('show');
            chatInput.focus();
        } else {
            generateImageBtn.classList.remove('active');
            chatInput.placeholder = "Ask anything...";
        }
    });
}

const trySpectraBtn = document.getElementById('try-spectra-btn');
const spectraModeContainer = document.getElementById('spectra-mode-container');

if (trySpectraBtn && spectraModeContainer && hometagContent) {
    trySpectraBtn.addEventListener('click', () => {
        const plusBtn = document.getElementById('plus-btn');
        const micBtn = document.getElementById('mic-btn');
        const inputActionsMenu = document.getElementById('input-actions-menu');

        // Toggle visibility
        if (spectraModeContainer.style.display === 'none') {
            hometagContent.style.display = 'none';
            spectraModeContainer.style.display = 'block';
            document.body.classList.add('spectra-mode-active');

            // Backup hiding in case CSS fails to load immediately or specificity issues
            if (plusBtn) plusBtn.style.display = 'none';
            if (micBtn) micBtn.style.display = 'none';
            if (inputActionsMenu) {
                inputActionsMenu.style.display = 'none';
                inputActionsMenu.classList.remove('show');
            }
            if (chatInput) chatInput.placeholder = "Enter the additional thoughts";

        } else {
            hometagContent.style.display = 'block';
            spectraModeContainer.style.display = 'none';
            document.body.classList.remove('spectra-mode-active');

            if (plusBtn) plusBtn.style.display = '';
            if (micBtn) micBtn.style.display = '';
            if (inputActionsMenu) {
                inputActionsMenu.style.display = '';
            }
            if (chatInput) chatInput.placeholder = "Ask anything...";
        }
    });
}
function initSpectraUploads() {
    ['1', '2'].forEach(id => {
        const container = document.getElementById(`spectra-upload-${id}`);
        const fileInput = document.getElementById(`spectra-file-${id}`);

        if (container && fileInput) {
            container.addEventListener('click', (e) => {
                // Prevent triggering if clicking on delete button (if added later dynamically) or image
                if (e.target.closest('.delete-spectra-img')) return;
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {

                    // Multi-upload handling for Input 1
                    if (id === '1' && files.length >= 2) {
                        const file1 = files[0];
                        const file2 = files[1];

                        // Process File 1 for Container 1
                        displaySpectraPreview(container, fileInput, file1);

                        // Process File 2 for Container 2
                        const container2 = document.getElementById('spectra-upload-2');
                        const fileInput2 = document.getElementById('spectra-file-2');
                        if (container2 && fileInput2) {
                            // Manually set the file for input 2 using DataTransfer
                            const dt = new DataTransfer();
                            dt.items.add(file2);
                            fileInput2.files = dt.files;

                            // Trigger preview for Container 2
                            displaySpectraPreview(container2, fileInput2, file2);
                        }
                    } else {
                        // Standard single file handling
                        const file = files[0];
                        displaySpectraPreview(container, fileInput, file);
                    }
                }
            });
        }
    });
}

// Helper to show preview (refactored from inline to share logic)
function displaySpectraPreview(container, fileInput, file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        // Create preview HTML
        container.classList.add('has-image');

        // Store original content if not already stored
        if (!container.dataset.originalContent) {
            container.dataset.originalContent = Array.from(container.children)
                .filter(c => c !== fileInput)
                .map(c => c.outerHTML).join('');
        }

        container.innerHTML = `
            <img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">
            <div class="delete-spectra-img" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.5); border-radius: 50%; padding: 5px; cursor: pointer; color: white;">
                <i class='bx bx-x'></i>
            </div>
        `;
        container.appendChild(fileInput);

        // Add delete handler
        container.querySelector('.delete-spectra-img').addEventListener('click', (ev) => {
            ev.stopPropagation();
            resetSpectraContainer(container, fileInput);
        });
    };
    reader.readAsDataURL(file);
}

function resetSpectraContainer(container, fileInput) {
    fileInput.value = ''; // Clear input
    container.classList.remove('has-image');
    if (container.dataset.originalContent) {
        container.innerHTML = container.dataset.originalContent;
        container.appendChild(fileInput);
    } else {
        // Fallback if something went wrong
        container.innerHTML = `
            <i class='bx bx-arrow-from-bottom-stroke'></i>
            <span>Upload</span>
        `;
        container.appendChild(fileInput);
    }
}

// Initialize uploads
initSpectraUploads();

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

function createUserActionButtons(messageId, messageText) {
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'user-chat-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn copy-btn';
    copyBtn.innerHTML = '<i class="bx bx-copy" title="Copy"></i>';
    copyBtn.onclick = () => copyToClipboard(messageText, messageId);

    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-btn';
    editBtn.innerHTML = '<i class="bx bx-edit-alt" title="Edit"></i>';
    editBtn.onclick = () => editMessage(messageId, messageText);

    actionsDiv.appendChild(copyBtn);
    actionsDiv.appendChild(editBtn);

    return actionsDiv;
}

function editMessage(messageId, oldText) {
    const messageP = document.getElementById(messageId);
    if (!messageP) return;

    const originalContent = messageP.innerHTML;
    const parentLi = messageP.closest('li');

    // Create inline editor
    const editContainer = document.createElement('div');
    editContainer.className = 'inline-edit-container';

    const editWrapper = document.createElement('div');
    editWrapper.className = 'edit-wrapper';

    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = oldText;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'edit-btn-group';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'edit-save-btn';
    saveBtn.textContent = 'Save & Submit';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'edit-cancel-btn';
    cancelBtn.textContent = 'Cancel';

    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(cancelBtn);
    editWrapper.appendChild(textarea);
    editWrapper.appendChild(btnGroup);
    editContainer.appendChild(editWrapper);

    // Hide original text and show editor
    messageP.style.display = 'none';
    const actions = parentLi.querySelector('.user-chat-actions');
    if (actions) actions.style.display = 'none';
    parentLi.appendChild(editContainer);

    textarea.focus();

    cancelBtn.onclick = () => {
        editContainer.remove();
        messageP.style.display = 'block';
        if (actions) actions.style.display = 'flex';
    };

    saveBtn.onclick = () => {
        const newText = textarea.value.trim();
        if (!newText) return;

        // Forking Logic: Remove all subsequent messages from UI
        let current = parentLi.nextElementSibling;
        while (current) {
            let next = current.nextElementSibling;
            current.remove();
            current = next;
        }

        // Update current message UI
        messageP.textContent = newText;
        messageP.style.display = 'block';
        editContainer.remove();
        if (actions) actions.style.display = 'flex';

        // Trigger regeneration
        userMessage = newText;
        editingMessageId = messageId;

        // Hide home tag if it was visible (unlikely here but safe)
        if (hometagContent) hometagContent.style.display = "none";

        // Add loading state
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");
        chatbox.appendChild(incomingChatli);
        chatbox.scrollTo(0, chatbox.scrollHeight);

        generateResponse(incomingChatli, null);
    };
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
        let inCodeBlock = false;
        let tableLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            const pipeCount = (line.match(/\|/g) || []).length;

            // Detect start of a pre block
            if (line.match(/^<pre><code/)) {
                inCodeBlock = true;
                html += `${line}\n`;
                // If it also closes on the same line
                if (line.match(/<\/code><\/pre>/)) {
                    inCodeBlock = false;
                }
                continue;
            }

            // Inside a code block — emit raw
            if (inCodeBlock) {
                if (line.match(/<\/code><\/pre>/)) {
                    inCodeBlock = false;
                }
                html += `${line}\n`;
                continue;
            }

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

    const formattedText = formatStreamedText(translatedText);

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

        let actualUserPrompt = userMessage; // fallback
        const previousOutgoing = chatLi.previousElementSibling;
        if (previousOutgoing && previousOutgoing.classList.contains('outgoing')) {
            const raw = previousOutgoing.getAttribute('data-raw-text');
            if (raw) {
                actualUserPrompt = raw;
            } else {
                const userP = previousOutgoing.querySelector('p');
                if (userP) {
                    actualUserPrompt = userP.innerText || userP.textContent;
                    actualUserPrompt = actualUserPrompt.replace('Pasted text snippet', '').trim();
                }
            }

            // Set editing message ID so backend truncates history and replaces the previous user message exactly where it was
            const userP = previousOutgoing.querySelector('p');
            if (userP && userP.id) {
                editingMessageId = userP.id;
            }
        }

        const newIncomingChatli = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");

        chatLi.parentNode.replaceChild(newIncomingChatli, chatLi);

        chatbox.scrollTo(0, chatbox.scrollHeight);

        userMessage = actualUserPrompt;
        await generateResponse(newIncomingChatli);

    } catch (error) {
        showToast('Failed to regenerate response');
    }
}

let currentSpeech = null;
let currentUtterance = null;
let synthesis = window.speechSynthesis;

const settingsModal = document.getElementById('settings-modal');
const settingsTabs = document.querySelectorAll('.settings-tab-btn');
const settingsContents = document.querySelectorAll('.settings-tab-content');
const voiceSelect = document.getElementById('voice-select');
const testVoiceBtn = document.getElementById('test-voice-btn');
const saveVoiceBtn = document.getElementById('save-voice-btn');
let voices = [];
let preferredVoiceName = localStorage.getItem('chat_preferred_voice');

function initSettings() {

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => {

            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsContents.forEach(c => c.classList.remove('active'));


            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });


    loadVoices();
    if (synthesis.onvoiceschanged !== undefined) {
        synthesis.onvoiceschanged = loadVoices;
    }

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


    const voiceWrapper = document.getElementById('voice-wrapper');
    const voiceTrigger = document.getElementById('voice-trigger');
    const voiceOptions = document.getElementById('voice-options');

    if (voiceWrapper && voiceTrigger) {
        document.getElementById('settings-btn').addEventListener('click', (e) => {
            if (!checkGuestAccess('settings')) {
                e.preventDefault();
                return;
            }
            document.getElementById('settings-modal').classList.add('show');
        });

        document.getElementById('close-settings').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('show');
        });

        voiceTrigger.addEventListener('click', () => {
            voiceWrapper.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!voiceWrapper.contains(e.target)) {
                voiceWrapper.classList.remove('open');
            }
        });
    }

    if (saveVoiceBtn) {
        saveVoiceBtn.addEventListener('click', () => {
            const selectedOption = voiceOptions.querySelector('.voice-option.selected');
            if (selectedOption) {
                preferredVoiceName = selectedOption.getAttribute('data-value');
                localStorage.setItem('chat_preferred_voice', preferredVoiceName);
                saveUserPreferences({ voice: preferredVoiceName });
                document.getElementById("settings-modal").classList.remove("show"); // Dismiss on save
                showToast("Voice preference saved!");
            }
        });
    }


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

    const allowedLangs = ['ta-IN', 'ta', 'te-IN', 'te', 'ml-IN', 'ml', 'en-IN', 'en-US', 'en-GB'];

    const filteredVoices = voices.filter(voice => {
        const voiceLang = voice.lang.replace('_', '-');
        return allowedLangs.some(lang => voiceLang.includes(lang));
    });

    if (filteredVoices.length === 0) {
        voiceOptionsContainer.innerHTML = '<div class="voice-option" style="cursor: default;">No compatible voices found</div>';
        return;
    }

    filteredVoices.sort((a, b) => a.lang.localeCompare(b.lang));

    const coolVoiceNames = [
        "Aura", "Nova", "Echo", "Flux", "Bolt", "Zen", "Onyx", "Ruby", "Slate", "Jade",
        "Luna", "Sol", "Mars", "Vega", "Orion", "Lyra", "Atlas", "Titan", "Siren", "Muse",
        "Ion", "Pulse", "Vibe", "Drift", "Glow", "Mist", "Rift", "Spark", "Tide", "Wind"
    ];

    filteredVoices.forEach((voice, index) => {
        const option = document.createElement('div');
        option.className = 'voice-option';

        // Deterministically assign a cool name
        const customName = coolVoiceNames[index % coolVoiceNames.length];

        // Check if there are multiple voices with the same name (e.g. if list loops), maybe append lang code for clarity?
        // User asked for "one word", so let's stick to the name, maybe use a title attribute for details?
        option.textContent = customName;
        option.title = `${voice.name} (${voice.lang})`; // Tooltip for power users

        option.setAttribute('data-value', voice.name);

        if (voice.name === preferredVoiceName) {
            option.classList.add('selected');
            document.getElementById('voice-display').textContent = customName;
        }

        option.addEventListener('click', () => {
            voiceOptionsContainer.querySelectorAll('.voice-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            document.getElementById('voice-display').textContent = customName;

            preferredVoiceName = voice.name;

            document.getElementById('voice-wrapper').classList.remove('open');
        });

        voiceOptionsContainer.appendChild(option);
    });
}

if (document.getElementById('save-voice-btn')) {
    initSettings();
} else {
    setTimeout(() => {
        if (document.getElementById('save-voice-btn')) initSettings();
    }, 1000);
}


function initModelDropdown() {
    const modelWrapper = document.getElementById('model-wrapper');
    const modelTrigger = document.getElementById('model-trigger');
    const modelOptions = document.getElementById('model-options');
    const modelSelectInput = document.getElementById('model-select');
    const modelDisplay = document.getElementById('model-display');

    if (modelWrapper && modelTrigger && modelOptions) {
        modelTrigger.addEventListener('click', () => {
            if (!checkGuestAccess('model')) return;
            modelWrapper.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!modelWrapper.contains(e.target)) {
                modelWrapper.classList.remove('open');
            }
        });


        const options = modelOptions.querySelectorAll('.model-option');
        options.forEach(option => {
            option.addEventListener('click', () => {

                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');


                const value = option.getAttribute('data-value');
                const text = option.textContent;


                modelDisplay.textContent = text;
                modelSelectInput.value = value;

                // Close dropdown
                modelWrapper.classList.remove('open');
            });
        });
    }
}


if (document.readyState === 'complete') {

}



initModelDropdown();

// --- Guest Access Control ---
function checkGuestAccess(feature) {
    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (userEmail) return true; // Logged in users have full access

    if (feature === 'chat') {
        // Bypass limit on localhost for easier development/testing
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        let guestCount = parseInt(localStorage.getItem('guest_chat_count') || '0');
        const GUEST_LIMIT = isLocalhost ? 10000 : 1000; // Much higher limit

        if (guestCount < GUEST_LIMIT) {
            localStorage.setItem('guest_chat_count', (guestCount + 1).toString());
            return true;
        } else {
            showLoginAlert("You've reached the guest limit. Please sign in to continue.");
            return false;
        }
    } else {
        // All other features (model, image, settings, gallery, search) require login
        const featureNames = {
            'model': 'changing AI models',
            'image': 'image generation',
            'settings': 'accessing settings',
            'gallery': 'viewing the gallery',
            'search': 'web search'
        };
        const action = featureNames[feature] || 'this feature';
        showLoginAlert(`Please sign in to access ${action}.`);
        return false;
    }
}

function showLoginAlert(message) {
    const modal = document.getElementById('login-limit-modal');
    const msgElement = document.getElementById('login-limit-message');
    const cancelBtn = document.getElementById('login-cancel');
    const loginBtn = document.getElementById('login-redirect');

    if (modal && msgElement) {
        msgElement.textContent = message;
        modal.classList.add('show');
        console.log("Login Alert Shown:", message);

        const close = () => {
            modal.classList.remove('show');
        };

        // Professional event handling with addEventListener
        cancelBtn.onclick = null; // Clear any old handlers
        loginBtn.onclick = null;

        cancelBtn.addEventListener('click', close, { once: true });
        loginBtn.addEventListener('click', () => {
            console.log("Sign In Button Clicked");
            close();
            window.location.href = '/login/';
        }, { once: true });

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }
}



async function loadUserPreferences(email) {
    if (!email) return;
    try {
        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/user/preferences/${email}`, { headers });
        if (response.ok) {
            const prefs = await response.json();
            applyUserPreferences(prefs);
        }
    } catch (e) {
        if (e.name === 'TypeError' && e.message.includes('fetch')) {
            console.warn("Backend appears to be offline. Preferences not loaded.");
        } else {
            console.error("Failed to load prefs", e);
        }
    }
}

function applyUserPreferences(prefs) {

    if (prefs.theme) {
        const isWhite = prefs.theme === 'white';

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


    if (prefs.voice) {
        preferredVoiceName = prefs.voice;
        localStorage.setItem('chat_preferred_voice', prefs.voice);
        const voiceDisplay = document.getElementById('voice-display');
        if (voiceDisplay) voiceDisplay.textContent = prefs.voice;
    }

    if (prefs.gender) {
        const genderInput = document.getElementById('user-gender');
        if (genderInput) genderInput.value = prefs.gender;
        const display = document.querySelector('#gender-wrapper .custom-select-trigger span');

        if (display) display.textContent = prefs.gender || "Prefer not to say";
    }

}

async function saveUserPreferences(updates) {

    let email = localStorage.getItem('chat_user_email');


    if (!email) {
        email = document.getElementById('loggedUserEmail')?.textContent;
    }

    if (!email) return;

    try {
        const token = await getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${API_BASE_URL}/user/preferences`, {
            method: 'POST',
            headers: headers,
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

    synthesis.cancel();


    document.querySelectorAll('.speaking-highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
    });

    const messageEl = document.getElementById(messageId);
    if (!messageEl) return;


    const textToSpeak = messageEl.textContent;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance = utterance;


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

    removeHighlight(rootEl.id);

    if (!rootEl) return;

    const treeWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);

    let currentCharCount = 0;
    let targetNode = null;
    let targetOffset = 0;

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

const createList = (message, className, isComplete = false, dbId = null) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    // Use dbId if provided (prefixed with msg_), otherwise generate random
    const messageID = dbId ? ("msg_" + dbId) : ("msg_" + Math.random().toString(36).substr(2, 9));

    let chatContent = '';

    if (className === "outgoing") {
        chatContent = `<p id="${messageID}" class="user-message">${message} </p>`;
    } else {
        const isImageGen = message.includes('generated-image-container');
        const tag = isImageGen ? 'div' : 'p';
        chatContent = `<${tag} id="${messageID}" class="chat-content">${message}</${tag}>`;
    }

    chatLi.innerHTML = chatContent;

    if (className === "incoming") {
        const actionButtons = createActionButtons(messageID, message, isComplete);
        chatLi.appendChild(actionButtons);
    } else if (className === "outgoing") {
        const actionButtons = createUserActionButtons(messageID, message);
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

    // Code block extraction — BEFORE escapeHTML to prevent corruption
    // This also handles streaming (incomplete) code blocks
    const codeBlocks = [];

    // 1. Extract complete code blocks (``` ... ```)
    processedText = processedText.replace(/```(\w*)[ \t]*\n?([\s\S]*?)```/gim, (match, lang, code) => {
        codeBlocks.push({ lang: (lang || '').trim(), code });
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // 2. Extract incomplete code blocks (streaming: ``` opened but not yet closed)
    processedText = processedText.replace(/```(\w*)[ \t]*\n?([\s\S]*)$/, (match, lang, code) => {
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
        // NOTE: triple-backtick blocks are now pre-extracted; no regex needed here
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
        if (trimmed.match(/^__CODE_BLOCK_\d+__$/)) {
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

    if (inList) html += '</ul>';

    // Restore code blocks with premium ChatGPT/Claude-style HTML and highlight.js
    html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        const block = codeBlocks[parseInt(index)];
        if (!block) return match;
        const langLabel = block.lang || 'plaintext';
        let langClass = block.lang ? `language-${block.lang}` : 'language-plaintext';
        let formattedCode = escapeHTML(block.code);

        try {
            if (window.hljs) {
                if (block.lang && hljs.getLanguage(block.lang)) {
                    formattedCode = hljs.highlight(block.code, { language: block.lang, ignoreIllegals: true }).value;
                } else {
                    formattedCode = hljs.highlightAuto(block.code).value;
                }
                langClass += ' hljs';
            }
        } catch (e) {
            console.error("Syntax Highlighting Error:", e);
        }

        return `<div class="code-block-wrapper" data-lang="${block.lang || 'txt'}"><div class="code-header"><span class="code-lang-label">${langLabel}</span><div class="code-header-actions"><button class="copy-code-btn" onclick="copyCodeBlock(this)"><i class='bx bx-copy'></i> Copy</button><button class="download-code-btn" onclick="downloadCodeBlock(this)"><i class='bx bx-download'></i> Download</button></div></div><pre class="code-pre"><code class="${langClass}">${formattedCode}</code></pre></div>`;
    });

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
let pastedLongText = null;
let editingMessageId = null; // Track if we are editing an existing message

async function generateResponse(incomingChatli, fileToUpload) {
    const messageElement = incomingChatli.querySelector('p');
    let fullText = ""; // Scoped for access in catch block

    // Stop any existing generation
    if (abortController) {
        abortController.abort();
    }
    abortController = new AbortController();

    try {
        const selectedModel = document.getElementById("model-select").value;

        // Resolve precise API model value from the selector presets or custom settings
        let actualModelToUse = selectedModel;

        if (selectedModel === "auto") {
            actualModelToUse = "gemini-2.5-flash"; // Auto balances cost & speed
        } else if (selectedModel === "fast") {
            actualModelToUse = "gemini-2.5-flash-lite"; // Faster responses
        } else if (selectedModel === "deep") {
            actualModelToUse = "moonshotai/kimi-k2-instruct-0905"; // Powerful reasoning
        }

        // Override with custom default model from settings if configured by the user, and if they selected "auto" or just let it fall back
        const savedSettingsCheck = localStorage.getItem("chatSettings");
        if (savedSettingsCheck) {
            const settingsObj = JSON.parse(savedSettingsCheck);
            if (settingsObj.defaultModel) {
                actualModelToUse = settingsObj.defaultModel;
                // Set UI to match if user selected from settings explicitly
                const display = document.getElementById('settings-model-display');
                if (display) {
                    const overrideText = display.textContent;
                    // Optional UI sync logic here if needed
                }
            }
        }

        const formData = new FormData();
        formData.append("message", userMessage);
        formData.append("model", actualModelToUse);
        if (editingMessageId) {
            formData.append("editMessageId", editingMessageId.replace('msg_', ''));
            // Reset after sending
            editingMessageId = null;
        }

        const userEmail = getCurrentUserEmail();
        // Fetch token FIRST to determine if we are truly logged in vs guest
        const token = userEmail ? await getAuthToken() : null;

        // Guest Access Check
        if (!checkGuestAccess('chat')) {
            incomingChatli.remove();
            return;
        }

        if (token && userEmail) {
            formData.append("email", userEmail);
        } else {
            formData.append("email", "guest");
            formData.append("isGuest", "true");
        }

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
        } else {
            formData.append("webSearch", "false");
        }

        if (fileToUpload) {
            formData.append("image", fileToUpload);
        }


        const savedSettings = localStorage.getItem("chatSettings");
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.gender) formData.append('gender', settings.gender);
            if (settings.ageGroup) formData.append('ageGroup', settings.ageGroup);
            if (settings.language) formData.append('language', settings.language);
            if (settings.culture) formData.append('culture', settings.culture);
            // New AI behavior options
            if (settings.writingStyle) formData.append('writingStyle', settings.writingStyle);
            if (settings.creativity) formData.append('creativityLevel', settings.creativity);
            if (settings.interests) formData.append('interests', settings.interests);
            if (settings.customRules) formData.append('customRules', settings.customRules);
        }

        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            headers['x-guest-mode'] = 'true';
        }

        // Update UI to Stop Button
        const micBtn = document.getElementById('mic-btn');
        const originalMicContent = micBtn.innerHTML;
        const originalMicTitle = micBtn.title;
        let isStopped = false;

        micBtn.innerHTML = "<i class='bx bxs-stop'></i>";
        micBtn.title = "Stop generating";
        micBtn.classList.add('stop-generating');

        // Remove old listeners to prevent recording toggle (handled by class check in global listener or separate replacement)
        // Since global listener toggles recording, we might need a flag or separate handling.
        // Assuming global listener checks class or we replace element. 
        // Better: Update global listener to check for 'stop-generating' class. 
        // For now, let's assume we need to handle the stop logic in the existing listener or here.
        // Actually, best to handle it by updating the global micBtn listener, but let's see where it is.
        // Line 2370 adds click listener. We should modify that one.

        // Let's implement the abort logic in the fetch signal

        response = await fetch(`${API_BASE_URL}/stream`, {
            method: "POST",
            headers: headers,
            body: formData,
            signal: abortController.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        fullText = ""; // Reset

        let displayedText = "";
        let isStreaming = true;
        const typingDelay = 25; // ms between characters

        const animateText = () => {
            // Capture state of all think blocks in this message
            const openIndices = new Set();
            messageElement.querySelectorAll('details.think-block-details').forEach((el, index) => {
                if (el.hasAttribute('open')) openIndices.add(index);
            });

            if (displayedText.length < fullText.length) {
                // Calculate dynamic chunk size to catch up if buffer is large
                const bufferSize = fullText.length - displayedText.length;

                // Tiered Catch-up Logic to prevent "fast start" jolt
                let chunkSize = 1;
                if (bufferSize > 500) {
                    chunkSize = 4; // Capped speed for large buffers
                } else if (bufferSize > 200) {
                    chunkSize = 2; // Moderate speed-up
                }

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
                setTimeout(animateText, typingDelay);
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
                setTimeout(animateText, typingDelay);
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
                    loadSessions(true);
                } else if (line.startsWith("event: message_ids")) {
                    try {
                        const dataStr = line.split("\n")[1].replace("data: ", "").trim();
                        const { userMsgId, modelMsgId } = JSON.parse(dataStr);
                        // Sync IDs in domestic UI
                        // User message is the one BEFORE incomingChatli
                        const userChatli = incomingChatli.previousElementSibling;
                        if (userChatli && userChatli.classList.contains('outgoing')) {
                            const userP = userChatli.querySelector('p');
                            if (userP) userP.id = "msg_" + userMsgId;
                        }
                        // Model message is incomingChatli
                        const modelP = incomingChatli.querySelector('p');
                        if (modelP) modelP.id = "msg_" + modelMsgId;

                        console.log("[Sync] Updated message IDs from server:", userMsgId, modelMsgId);
                    } catch (e) {
                        console.error("Error syncing message IDs", e);
                    }
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
        if (error.name === 'AbortError') {
            messageElement.innerHTML += `<br><span style="color:var(--text-color); opacity: 0.7;">[Stopped]</span>`;
            const actionButtons = incomingChatli.querySelector('.chat-actions');
            if (actionButtons) {
                const newActionButtons = createActionButtons(messageElement.id, fullText, true);
                actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                newActionButtons.style.display = 'flex';
            }
        } else {
            showToast('Error: ' + error.message);
            console.error(error);
            messageElement.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
        }
    } finally {
        sendButton.style.display = "block";
        chatInput.value = "";
        abortController = null;

        // Reset Mic Button
        const micBtn = document.getElementById('mic-btn');
        micBtn.innerHTML = "<i class='bx bxs-microphone-big'></i>";
        micBtn.title = "Start speaking";
        micBtn.classList.remove('stop-generating');
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

// --- Advanced Search Logic ---
let isSearchMode = false;
const webSearchBtn = document.getElementById("web-search");
const searchSidePanel = document.getElementById("search-side-panel");
const closeSidePanelBtn = document.getElementById("close-side-panel");
const searchResultsContainer = document.getElementById("search-results-container");
const toggleSearchPanelBtn = document.getElementById("toggle-search-panel-btn");

// Function to open panel and adjust layout
function openSearchPanel() {
    searchSidePanel.classList.add("open");
    document.body.classList.add("search-panel-open");
    if (toggleSearchPanelBtn) toggleSearchPanelBtn.style.color = "var(--primary-color, #4caf50)"; // Highlight
}

// Function to close panel and adjust layout
function closeSearchPanel() {
    searchSidePanel.classList.remove("open");
    document.body.classList.remove("search-panel-open");
    if (toggleSearchPanelBtn) toggleSearchPanelBtn.style.color = "white"; // Reset
}

if (webSearchBtn) {
    webSearchBtn.addEventListener("click", () => {
        if (!checkGuestAccess('search')) return;
        isSearchMode = !isSearchMode;
        const chatInputContainer = document.querySelector(".chat-input"); // Use class selector for safety if ID varies
        if (isSearchMode) {
            webSearchBtn.classList.add("active");
            if (chatInputContainer) chatInputContainer.classList.add("active");
        } else {
            webSearchBtn.classList.remove("active");
            if (chatInputContainer) chatInputContainer.classList.remove("active");
        }

        const chatInput = document.getElementById("inputa");
        if (chatInput) {
            chatInput.placeholder = isSearchMode ? "Search Google..." : "Ask anything...";
        }

        showToast(isSearchMode ? "Search Mode ON" : "Search Mode OFF");
    });
}

if (closeSidePanelBtn) {
    closeSidePanelBtn.addEventListener("click", () => {
        closeSearchPanel();
        // Show the toggle button if we have results so user can re-open
        if (searchResultsContainer.children.length > 0 && toggleSearchPanelBtn) {
            toggleSearchPanelBtn.style.display = "block";
        }
    });
}

if (toggleSearchPanelBtn) {
    toggleSearchPanelBtn.addEventListener("click", () => {
        if (searchSidePanel.classList.contains("open")) {
            closeSearchPanel();
        } else {
            openSearchPanel();
        }
    });
}


// Function to reset search mode on load
function resetSearchMode() {
    isSearchMode = false;
    if (webSearchBtn) webSearchBtn.classList.remove("active");
    const chatInputContainer = document.querySelector(".chat-input");
    if (chatInputContainer) chatInputContainer.classList.remove("active");
    const chatInput = document.getElementById("inputa");
    if (chatInput) chatInput.placeholder = "Ask anything...";
}

async function handleSearchFlow(prompt, incomingChatli) {
    try {
        // Open Side Panel
        openSearchPanel();
        if (toggleSearchPanelBtn) toggleSearchPanelBtn.style.display = "block"; // Ensure it's available

        // Auto-disable search mode after triggering
        if (webSearchBtn) {
            isSearchMode = false;
            webSearchBtn.classList.remove("active");
            const chatInputContainer = document.getElementById("chat-input");
            if (chatInputContainer) chatInputContainer.classList.remove("active");
            // Optional: toast to say search executed? Maybe redundant.
        }

        searchResultsContainer.innerHTML = `
            <div class="search-loader">
                <i class='bx bx-loader-alt bx-spin' style="font-size: 2rem; color: var(--primary-color);"></i>
            </div>
            <p style="text-align:center; color: white;">Generating queries...</p>
        `;

        // 1. Generate Queries
        const token = await getAuthToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // Initial feedback in chat
        incomingChatli.querySelector("p").textContent = "Analyzing prompt and generating search queries...";

        const queryRes = await fetch(`${API_BASE_URL}/generate-search-queries`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ prompt: prompt })
        });

        if (!queryRes.ok) {
            const errData = await queryRes.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${queryRes.status}`);
        }

        const queryData = await queryRes.json();

        if (!queryData.queries || queryData.queries.length === 0) {
            throw new Error("No queries generated");
        }

        const queries = queryData.queries;
        incomingChatli.querySelector("p").textContent = `Searching for:\n${queries.map(q => "- " + q).join("\n")}`;

        searchResultsContainer.innerHTML = ""; // Clear loader

        const overviewBtn = document.createElement("button");
        overviewBtn.className = "ai-overview-btn";
        overviewBtn.innerHTML = "<i class='bx bx-brain'></i> Generate AI Overview";
        overviewBtn.onclick = () => handleOverviewClick(prompt);
        searchResultsContainer.appendChild(overviewBtn);

        const searchPromises = queries.slice(0, 2).map(q =>
            fetch(`${API_BASE_URL}/search-results?query=${encodeURIComponent(q)}`, { headers })
                .then(r => r.json())
        );

        const resultsArray = await Promise.all(searchPromises);
        let allResults = [];
        resultsArray.forEach(data => {
            if (data.results) allResults.push(...data.results);
        });


        const uniqueResults = [];
        const seenLinks = new Set();
        for (const r of allResults) {
            if (!seenLinks.has(r.link)) {
                seenLinks.add(r.link);
                uniqueResults.push(r);
            }
        }

        if (uniqueResults.length === 0) {
            searchResultsContainer.innerHTML = "<p>No results found.</p>";
            incomingChatli.querySelector("p").textContent = "No search results found.";
            return;
        }


        uniqueResults.forEach(result => {
            const card = document.createElement("div");
            card.className = "search-result-card";
            card.innerHTML = `
                <div class="search-result-title">${result.title}</div>
                <div class="search-result-link">${result.link}</div>
                <div class="search-result-snippet">${result.snippet || "No snippet available."}</div>
            `;
            card.addEventListener("click", () => handleResultClick(result.link, prompt));
            searchResultsContainer.appendChild(card);
        });


        const contextPrompt = `
            User Prompt: "${prompt}"
            Search Results Found: ${uniqueResults.length}
            Top Result: "${uniqueResults[0]?.title}"
            
            Task: Write a short, natural, and helpful response (1-2 sentences) telling the user that you found relevant results and they are available in the side panel. Mention the top result briefly if relevant. Do NOT list all results. Encourage them to click a result to analyze it.
        `;

        const completionRes = await fetch(`${API_BASE_URL}/chat-completion`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ prompt: contextPrompt })
        });

        if (completionRes.ok) {
            const completionData = await completionRes.json();

            incomingChatli.querySelector("p").innerText = completionData.text;
        } else {

            incomingChatli.querySelector("p").textContent = "All set! Your search results are ready in the side panel. Click any link to explore!";
        }

    } catch (error) {
        console.error("Search flow error:", error);
        searchResultsContainer.innerHTML = `<p style="color:var(--text-color); opacity: 0.7;">Oops! I hit a snag while searching.</p>`;
        incomingChatli.querySelector("p").textContent = "My apologies, I ran into a little trouble finding that for you. Mind trying again?";
    } finally {

        if (webSearchBtn && isSearchMode) {
            isSearchMode = false;
            webSearchBtn.classList.remove("active");
            const chatInputContainer = document.getElementById("chat-input");
            if (chatInputContainer) chatInputContainer.classList.remove("active");
            showToast("Search Mode Auto-Disabled");
        }
    }
}

async function handleResultClick(url, originalPrompt) {
    try {
        closeSearchPanel();
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");
        chatbox.appendChild(incomingChatli);
        chatbox.scrollTo(0, chatbox.scrollHeight);

        const messageElement = incomingChatli.querySelector('p');

        messageElement.style.display = "none";

        const cardDiv = document.createElement("div");
        cardDiv.innerHTML = `
        <div class="analyzing-link-card">
            <div class="analyzing-icon">
                <i class='bx bx-radar bx-spin'></i>
            </div>
            <div class="analyzing-info">
                <span class="analyzing-label">Analyzing Source</span>
                <a href="${url}" target="_blank" class="analyzing-url">
                    <i class='bx bx-link-external'></i> Link
                </a>
            </div>
        </div>`;
        incomingChatli.appendChild(cardDiv);

        const token = await getAuthToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/analyze-url-stream`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                url: url,
                email: localStorage.getItem("loggedInUserEmail"),
                prompt: originalPrompt,
                sessionId: currentSessionId
            })
        });

        if (!res.ok) throw new Error("Failed to start analysis stream");

        await streamResponseToChat(res, incomingChatli);

    } catch (error) {
        console.error("Analysis error:", error);
        showToast("Oops! Couldn't analyze that link just now.");
        incomingChatli.querySelector('p').innerHTML = "I had a bit of trouble reading that link. Maybe try another one?";
    }
}

async function handleOverviewClick(originalPrompt) {
    try {
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="/public/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");
        chatbox.appendChild(incomingChatli);
        chatbox.scrollTo(0, chatbox.scrollHeight);

        const messageElement = incomingChatli.querySelector('p');
        messageElement.innerHTML = `Generating AI Overview...<br><i class='bx bx-loader-alt bx-spin'></i>`;

        const token = await getAuthToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/search-overview-stream`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                query: originalPrompt,
                email: localStorage.getItem("loggedInUserEmail"),
                sessionId: currentSessionId
            })
        });

        if (!res.ok) throw new Error("Failed to start overview stream");

        await streamResponseToChat(res, incomingChatli);

    } catch (error) {
        console.error("Overview error:", error);
        showToast("Hiccup! Couldn't generate an overview.");
        incomingChatli.querySelector('p').innerHTML = "I struggled to summarize everything this time. Want to try a slightly different search?";
    }
}

async function streamResponseToChat(response, incomingChatli) {
    const messageElement = incomingChatli.querySelector('p');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";
    let displayedText = "";
    let isStreaming = true;
    stopDisplayFlag = false; // Reset on each new stream


    const animateText = () => {

        const openIndices = new Set();
        messageElement.querySelectorAll('details.think-block-details').forEach((el, index) => {
            if (el.hasAttribute('open')) openIndices.add(index);
        });

        if (stopDisplayFlag) {
            // User clicked stop — immediately render whatever has been displayed so far as final
            let html = formatStreamedText(displayedText);
            let count = 0;
            html = html.replace(/<details class="think-block-details">/g, (match) => {
                const isOpen = openIndices.has(count++);
                return isOpen ? '<details class="think-block-details" open>' : match;
            });
            messageElement.innerHTML = html;
            chatbox.scrollTo(0, chatbox.scrollHeight);
            const actionButtons = incomingChatli.querySelector('.chat-actions');
            if (actionButtons) {
                const newActionButtons = createActionButtons(messageElement.id, displayedText, true);
                actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                newActionButtons.style.display = 'flex';
            }
            return; // Stop the animation loop entirely
        }

        if (displayedText.length < fullText.length) {
            const bufferSize = fullText.length - displayedText.length;
            const chunkSize = Math.max(1, Math.min(bufferSize, Math.ceil(bufferSize / STREAMING_SPEED_MODIFIER) + 1));
            displayedText += fullText.slice(displayedText.length, displayedText.length + chunkSize);
            let html = formatStreamedText(displayedText);


            let count = 0;
            html = html.replace(/<details class="think-block-details">/g, (match) => {
                const isOpen = openIndices.has(count++);
                return isOpen ? '<details class="think-block-details" open>' : match;
            });

            messageElement.innerHTML = html;
            chatbox.scrollTo(0, chatbox.scrollHeight);
            requestAnimationFrame(animateText);
        } else if (!isStreaming) {
            let html = formatStreamedText(fullText);


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
                loadSessions(true);
            } else if (line.startsWith("data: ")) {
                const dataStr = line.replace("data: ", "").trim();
                if (dataStr === "done") break;
                try {
                    const data = JSON.parse(dataStr);
                    if (data.text) fullText += data.text;
                    if (data.error) {
                        messageElement.innerHTML += `<br><span style="color:red">Error: ${data.error}</span>`;
                        isStreaming = false;
                    }
                } catch (e) { }
            }
        }
    }
}

function ChatHandle() {

    userMessage = chatInput.value.trim();
    if (!userMessage && !file && !pastedLongText) {
        const randomIndex = Math.floor(Math.random() * alertMessages.length);
        showToast(alertMessages[randomIndex]);
        return;
    }

    if (isImageGenMode) {
        handleImageGeneration();
        return;
    }

    if (spectraModeContainer && spectraModeContainer.style.display !== 'none') {
        sendToBananaModel();
        return;
    }

    sendButton.style.display = "none";
    hometagContent.style.display = "none";
    document.getElementById("chat-input").classList.add("hide-before");

    let displayMessage = userMessage;
    const currentFile = file;

    // Attach pasted text to actual backend payload
    if (pastedLongText) {
        if (userMessage) {
            userMessage += "\n\n[PASTED TEXT]:\n" + pastedLongText;
        } else {
            userMessage = pastedLongText;
        }

        if (displayMessage && displayMessage.trim() !== "") {
            displayMessage += `<br>`;
        }
        displayMessage += `<span class="chat-outgoing-file"><i class='bx bx-text'></i> <span class="file-name">Pasted text snippet</span></span>`;
    }

    if (currentFile) {
        if (displayMessage && displayMessage.trim() !== "") {
            displayMessage += `<br>`;
        }
        if (currentFile.type && currentFile.type.startsWith('image/')) {
            const fileUrl = URL.createObjectURL(currentFile);
            displayMessage += `<img src="${fileUrl}" class="chat-outgoing-image">`;
        } else {
            displayMessage += `<span class="chat-outgoing-file"><i class='bx bxs-file'></i> <span class="file-name">${currentFile.name}</span></span>`;
        }
    }

    const li = createList(displayMessage, "outgoing");
    li.setAttribute("data-raw-text", userMessage);

    const actionButtons = li.querySelector('.user-chat-actions');
    if (actionButtons) {
        const rawEditText = chatInput.value.trim();
        const newActionButtons = createUserActionButtons(li.querySelector("p").id, rawEditText);
        actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
    }

    chatbox.appendChild(li);

    chatInput.value = "";
    chatbox.scrollTo(0, chatbox.scrollHeight);

    file = null;
    pastedLongText = null;
    fileUpload.value = '';

    document.getElementById('file-preview').classList.add('hidden');
    const pastedPreview = document.getElementById('pasted-text-preview');
    if (pastedPreview) pastedPreview.classList.add('hidden');

    const img = document.querySelector('#file-preview .preview-thumbnail');
    if (img) img.style.display = 'none';

    setTimeout(() => {
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming")
        chatbox.appendChild(incomingChatli);

        if (isSearchMode) {
            handleSearchFlow(userMessage, incomingChatli);
        } else {
            generateResponse(incomingChatli, currentFile);
        }
    }, 600);


}

async function sendToBananaModel() {
    const prompt = chatInput.value.trim();
    if (!prompt) {
        showToast("Please enter a prompt for the Banana Model!");
        return;
    }

    const fileInput1 = document.getElementById('spectra-file-1');
    const fileInput2 = document.getElementById('spectra-file-2');

    // Retrieve files
    const photo1 = fileInput1 && fileInput1.files.length > 0 ? fileInput1.files[0] : null;
    const photo2 = fileInput2 && fileInput2.files.length > 0 ? fileInput2.files[0] : null;

    if (!photo1 || !photo2) {
        showToast("Both images are required for Spectra Mode.");
        return;
    }

    try {
        // UI Feedback
        chatInput.value = "";

        // Show user message immediately (optional, or wait for server)
        chatbox.appendChild(createList(prompt, "outgoing"));
        chatbox.scrollTo(0, chatbox.scrollHeight);

        // Loader
        const incomingChatli = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img" id="Loading_out_Icon"></span>', "incoming");
        chatbox.appendChild(incomingChatli);
        const messageElement = incomingChatli.querySelector('p');
        messageElement.innerHTML = `Generating Spectra Image... <i class='bx bx-loader-alt bx-spin'></i>`;
        chatbox.scrollTo(0, chatbox.scrollHeight);

        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('email', localStorage.getItem("loggedInUserEmail") || "guest"); // Or handle auth better
        formData.append('photo1', photo1);
        formData.append('photo2', photo2);
        if (currentSessionId) formData.append('sessionId', currentSessionId);

        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/spectra-generate`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Generation failed");
        }

        const data = await response.json();

        // Update Session ID if new
        if (data.sessionId) currentSessionId = data.sessionId;

        // Render Response
        // Text
        if (data.text) {
            messageElement.innerHTML = formatStreamedText(data.text);
        }

        // Image
        if (data.image && data.image.data) {
            const container = document.createElement('div');
            container.className = 'generated-image-container';

            const img = document.createElement('img');
            img.src = `data:${data.image.mimeType};base64,${data.image.data}`;
            img.alt = "Spectra Generated Image";
            img.className = 'generated-image';
            img.onclick = () => openImageModal(img.src, "Spectra Generated Image");

            const actions = document.createElement('div');
            actions.className = 'image-actions';
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'action-btn download-btn';
            downloadBtn.innerHTML = "<i class='bx bx-download'></i>";
            downloadBtn.onclick = () => downloadImage(img.src, "spectra-image");

            actions.appendChild(downloadBtn);
            container.appendChild(img);
            container.appendChild(actions);

            // Append to the list item's content area
            const contentDiv = incomingChatli.querySelector('.chat-content') || incomingChatli; // fallback if structure varies
            // Actually createList structure is li -> span(icon) + p + chat-actions. 
            // We can append image AFTER p within the same li? Or replace P if it was just loading text.

            // Let's append it after the text (p)
            messageElement.parentNode.insertBefore(container, messageElement.nextSibling);
        }

        chatbox.scrollTo(0, chatbox.scrollHeight);


    } catch (error) {
        console.error("Spectra Error:", error);
        showToast("Spectra generation failed: " + error.message);
        const incomingChatli = chatbox.lastElementChild;
        if (incomingChatli && incomingChatli.classList.contains("incoming")) {
            incomingChatli.querySelector('p').innerHTML = `<span style="color:red">Error: ${error.message}</span>`;
        }
    }
}

chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        ChatHandle();
    }
});

sendButton.addEventListener("click", ChatHandle);




function loadSessionsFinalRobust() {
    // This is just a helper to store the code I want to inject
}

// ... existing code ...
async function loadSessions(isFirstPage = false) {
    if (isSessionsLoading) return;

    const userEmail = localStorage.getItem('loggedInUserEmail');
    if (!userEmail) return;

    if (isFirstPage) {
        currentSessionPage = 1;
        sessionsCache = [];
        const historyList = document.getElementById('chat-history-list');
        if (historyList) {
            historyList.innerHTML = `
                <div class="history-skeleton-container">
                    ${Array(5).fill('<div class="history-skeleton-item"></div>').join('')}
                </div>
            `;
        }
    }

    isSessionsLoading = true;

    try {
        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const limit = 20;
        const res = await fetch(`${API_BASE_URL}/sessions/${userEmail}?page=${currentSessionPage}&limit=${limit}`, { headers });
        const data = await res.json();

        let sessionsToAdd = [];
        if (data && data.sessions && Array.isArray(data.sessions)) {
            sessionsToAdd = data.sessions;
            sessionsHasNextPage = data.hasNextPage;
        } else if (Array.isArray(data)) {
            sessionsToAdd = data;
            sessionsHasNextPage = false;
        }

        if (sessionsToAdd.length > 0) {
            sessionsCache = [...sessionsCache, ...sessionsToAdd];
            allSessions = sessionsCache;
            renderSessions(allSessions);
            updateSessionLoadMoreButton();

            if (sessionsHasNextPage) {
                currentSessionPage++;
            }
        } else {
            if (isFirstPage) {
                const historyList = document.getElementById('chat-history-list');
                if (historyList) historyList.innerHTML = '<div class="gallery-empty">No chats found</div>';
            }
            updateSessionLoadMoreButton();
        }

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.warn("Backend appears to be offline. Sessions not loaded.");
            if (isFirstPage) {
                const historyList = document.getElementById('chat-history-list');
                if (historyList) historyList.innerHTML = '<div class="gallery-empty">Offline: Connect to server to view history</div>';
            }
        } else {
            console.error("Failed to load sessions", error);
        }
    } finally {
        isSessionsLoading = false;
    }
}


function updateSessionLoadMoreButton() {
    let loadMoreContainer = document.getElementById('session-load-more-container');
    const historyList = document.getElementById('chat-history-list');

    if (!historyList) return;

    if (!loadMoreContainer) {
        loadMoreContainer = document.createElement('div');
        loadMoreContainer.id = 'session-load-more-container';
        loadMoreContainer.className = 'history-load-more';
        historyList.parentNode.insertBefore(loadMoreContainer, historyList.nextSibling);
    }

    if (sessionsHasNextPage) {
        loadMoreContainer.innerHTML = `<button class="session-load-more-btn" onclick="loadSessions()">Load More Chats</button>`;
        loadMoreContainer.style.display = 'block';
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

function renderSessions(sessionsToRender) {
    const list = document.getElementById("chat-history-list");
    if (!list) return;
    list.innerHTML = "";

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
        "Google Searches": [],
        "Today": [],
        "Yesterday": [],
        "Previous 7 Days": [],
        "Previous 30 Days": [],
        "Older": []
    };

    sessionsToRender.forEach(session => {
        if (session.isWebSearchEnabled) {
            groups["Google Searches"].push(session);
            return;
        }

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
                li.onclick = function (e) {
                    // Prevent loading session if delete button is clicked (double safety)
                    if (e.target.closest('.delete-session-btn')) return;
                    loadSession(session._id);
                };

                let iconClass = 'bx bx-message-square-detail';
                if (session.isWebSearchEnabled) {
                    iconClass = 'bx bx-planet';
                }

                li.innerHTML = `
                        <i class='${iconClass}'></i>
                        <span class="session-title">${session.title}</span>
                        <button class="delete-session-btn" onclick="event.stopPropagation(); deleteSession('${session._id}')" title="Delete Chat">
                            <i class='bx bx-trash'></i>
                        </button>
                    `;
                list.appendChild(li);
            });
        }
    }
}

const sidebarSearchInput = document.getElementById('sidebar-search-input');
if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderSessions(allSessions);
            return;
        }

        const filteredSessions = allSessions.filter(session =>
            session.title.toLowerCase().includes(query)
        );
        renderSessions(filteredSessions);
    });
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
        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/sessions/${userEmail}/${sessionId}/soft-delete`, {
            method: 'PATCH',
            headers: headers
        });

        if (res.ok) {
            showToast("Chat deleted");
            if (currentSessionId === sessionId) {
                startNewChat();
            } else {
                loadSessions(true);
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
        const token = await getAuthToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/session/${userEmail}/${sessionId}`, { headers });
        if (!res.ok) throw new Error("Failed to fetch session");
        const session = await res.json();

        currentSessionId = sessionId;

        // Restore Search Mode State
        const webSearchBtn = document.getElementById("web-search");
        const chatInputContainer = document.querySelector(".chat-input");
        const chatInput = document.getElementById("inputa");

        if (session.isWebSearchEnabled) {
            isSearchMode = true;
            if (webSearchBtn) webSearchBtn.classList.add("active");
            if (chatInputContainer) chatInputContainer.classList.add("active");
            if (chatInput) chatInput.placeholder = "Ask Google Search...";
        } else {
            isSearchMode = false;
            if (webSearchBtn) webSearchBtn.classList.remove("active");
            if (chatInputContainer) chatInputContainer.classList.remove("active");
            if (chatInput) chatInput.placeholder = "Ask anything...";
        }

        document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));

        chatbox.innerHTML = "";
        hometagContent.style.display = "none";
        document.getElementById("chat-input").classList.add("hide-before");

        if (session.messages && Array.isArray(session.messages)) {
            session.messages.forEach(msg => {
                if (!msg.parts || msg.parts.length === 0) return;

                if (msg.role === "user") {
                    const webScrapedPart = msg.parts.find(p => p.text && p.text.startsWith("Web-Scraped-Data"));
                    const textPart = msg.parts.find(p => p.text && !p.text.startsWith("System-Time") && !p.text.startsWith("Web-Scraped-Data")) || msg.parts[0];
                    const text = textPart ? textPart.text : "";

                    const escapeTextForHTML = (str) =>
                        String(str).replace(/[&<>"']/g, (tag) => (
                            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[tag]
                        ));

                    if (text && !text.startsWith("Web-Scraped-Data")) {
                        let displayMessage = text;
                        let rawEditText = text;

                        const pastedIndex = text.indexOf("\n\n[PASTED TEXT]:\n");
                        if (pastedIndex !== -1) {
                            const originalMessage = text.substring(0, pastedIndex);
                            displayMessage = escapeTextForHTML(originalMessage);
                            if (displayMessage && displayMessage.trim() !== "") {
                                displayMessage += `<br>`;
                            }
                            displayMessage += `<span class="chat-outgoing-file"><i class='bx bx-text'></i> <span class="file-name">Pasted text snippet</span></span>`;
                            rawEditText = originalMessage; // When editing, edit the text before pasting
                        } else if (text.startsWith("[PASTED TEXT]:\n")) {
                            displayMessage = `<span class="chat-outgoing-file"><i class='bx bx-text'></i> <span class="file-name">Pasted text snippet</span></span>`;
                            rawEditText = "";
                        } else {
                            displayMessage = escapeTextForHTML(text);
                        }

                        const imageParts = msg.parts.filter(p => p.inlineData);
                        if (imageParts && imageParts.length > 0) {
                            imageParts.forEach(imgPart => {
                                if (displayMessage && displayMessage.trim() !== "") {
                                    displayMessage += `<br>`;
                                }
                                displayMessage += `<img src="data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}" class="chat-outgoing-image">`;
                            });
                        }

                        const li = createList(displayMessage, "outgoing", false, msg._id);

                        const actionButtons = li.querySelector('.user-chat-actions');
                        if (actionButtons) {
                            const newActionButtons = createUserActionButtons(li.querySelector("p").id, rawEditText);
                            actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                        }

                        chatbox.appendChild(li);

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
                    const textPart = msg.parts.find(p => p.text && !p.text.startsWith("System-Time"));
                    const imagePart = msg.parts.find(p => p.inlineData);

                    if (imagePart) {
                        const li = createList('<span class="material-symbols-outlined"><img src="/assests/Star-icon.png" class="chatbot-img"></span>', "incoming", true, msg._id);
                        const container = document.createElement('div');
                        container.className = 'generated-image-container';

                        const img = document.createElement('img');
                        img.src = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
                        img.alt = "Generated Image";
                        img.className = 'generated-image';
                        img.onclick = () => openImageModal(img.src, "Generated Image");

                        const actions = document.createElement('div');
                        actions.className = 'image-actions';
                        const downloadBtn = document.createElement('button');
                        downloadBtn.className = 'action-btn download-btn';
                        downloadBtn.innerHTML = "<i class='bx bx-download'></i>";
                        downloadBtn.onclick = () => downloadImage(img.src, "generated-image");

                        actions.appendChild(downloadBtn);
                        container.appendChild(img);
                        container.appendChild(actions);

                        li.querySelector('.chat-content').innerHTML = '';
                        li.querySelector('.chat-content').appendChild(container);

                        // If it has both image AND text, we should probably render the text too
                        if (textPart && textPart.text) {
                            // Convert the <p> so it is below the image
                            const textC = document.createElement('p');
                            textC.innerHTML = formatStreamedText(textPart.text);
                            li.querySelector('.chat-content').appendChild(textC);
                            const actionButtons = li.querySelector('.chat-actions');
                            if (actionButtons) {
                                const newActionButtons = createActionButtons(li.querySelector(".chat-content").id, textPart.text, true);
                                actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                            }
                        }

                        chatbox.appendChild(li);
                    } else if (textPart) {
                        const text = textPart.text;
                        if (text) {
                            const li = createList("", "incoming", true, msg._id);
                            li.querySelector("p").innerHTML = formatStreamedText(text);
                            const actionButtons = li.querySelector('.chat-actions');
                            if (actionButtons) {
                                const newActionButtons = createActionButtons(li.querySelector("p").id, text, true);
                                actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                            }
                            chatbox.appendChild(li);
                        }
                    } else if (msg.parts[0] && msg.parts[0].text) {
                        const text = msg.parts[0].text;
                        const li = createList("", "incoming", true, msg._id);
                        li.querySelector("p").innerHTML = formatStreamedText(text);
                        const actionButtons = li.querySelector('.chat-actions');
                        if (actionButtons) {
                            const newActionButtons = createActionButtons(li.querySelector("p").id, text, true);
                            actionButtons.parentNode.replaceChild(newActionButtons, actionButtons);
                        }
                        chatbox.appendChild(li);
                    }
                }
            });
        }

        chatbox.scrollTo(0, chatbox.scrollHeight);

        if (sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
            document.getElementById("btn1").style.display = "block";
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

window.copyCodeBlock = function (btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const code = wrapper ? wrapper.querySelector('.code-pre code') : null;
    const text = code ? (code.textContent || '') : '';
    if (!text) return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            btn.innerHTML = "<i class='bx bx-check'></i> Copied!";
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = "<i class='bx bx-copy'></i> Copy";
                btn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            fallbackCopyCode(text, btn);
        });
    } else {
        fallbackCopyCode(text, btn);
    }
};

function fallbackCopyCode(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        btn.innerHTML = "<i class='bx bx-check'></i> Copied!";
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = "<i class='bx bx-copy'></i> Copy";
            btn.classList.remove('copied');
        }, 2000);
    } catch (e) {
        showToast('Copy failed. Please select and copy manually.');
    } finally {
        document.body.removeChild(ta);
    }
}

window.downloadCodeBlock = function (btn) {
    const wrapper = btn.closest('.code-block-wrapper');
    const code = wrapper ? wrapper.querySelector('.code-pre code') : null;
    const text = code ? (code.textContent || '') : '';
    if (!text) return;

    // Determine file extension from language
    const lang = (wrapper.dataset.lang || 'txt').toLowerCase();
    const extMap = {
        javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
        python: 'py', py: 'py', java: 'java', c: 'c', cpp: 'cpp',
        'c++': 'cpp', csharp: 'cs', cs: 'cs', go: 'go', rust: 'rs',
        ruby: 'rb', php: 'php', swift: 'swift', kotlin: 'kt',
        html: 'html', css: 'css', scss: 'scss', sql: 'sql',
        bash: 'sh', shell: 'sh', sh: 'sh', json: 'json',
        xml: 'xml', yaml: 'yaml', yml: 'yml', markdown: 'md', md: 'md',
        r: 'r', dart: 'dart', lua: 'lua', perl: 'pl'
    };
    const ext = extMap[lang] || 'txt';
    const filename = `code-snippet.${ext}`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Visual feedback
    btn.innerHTML = "<i class='bx bx-check'></i> Saved!";
    btn.classList.add('downloaded');
    setTimeout(() => {
        btn.innerHTML = "<i class='bx bx-download'></i> Download";
        btn.classList.remove('downloaded');
    }, 2000);
};

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
    setRandomGreeting();
    loadSessions(true);
    if (sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
        if (typeof closeBtn !== 'undefined') {

            document.getElementById("btn1").style.display = "block";
        }
    }
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


// ── Mic Button / Speech Recognition (Groq Whisper) ───────────────────────────
// Uses MediaRecorder to capture audio then sends it to the backend for
// transcription via Groq's whisper-large-v3-turbo model.
// Falls back gracefully if MediaDevices API is unavailable.
(function () {
    const overlay = document.getElementById('speaking-overlay');
    const liveText = document.getElementById('live-transcript');
    const stopBtn = document.getElementById('stop-speaking-btn');
    const inputarea = document.getElementById('inputa');

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    function showOverlay() {
        overlay.classList.remove('hidden');
        micBtn.classList.add('recording');
        if (liveText) liveText.textContent = 'Listening…';
    }

    function hideOverlay() {
        overlay.classList.add('hidden');
        micBtn.classList.remove('recording');
        if (liveText) liveText.textContent = '';
    }

    function setTranscribingState() {
        if (liveText) liveText.textContent = 'Transcribing…';
    }

    async function sendAudioForTranscription(blob) {
        setTranscribingState();
        try {
            const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
            const formData = new FormData();
            formData.append('audio', blob, `recording.${ext}`);

            const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.details || err.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const transcript = (data.text || '').trim();

            if (transcript) {
                const current = inputarea.value.trim();
                inputarea.value = current ? current + ' ' + transcript : transcript;
                inputarea.dispatchEvent(new Event('input'));
                inputarea.focus();
                showToast('✓ Transcribed!');
            } else {
                showToast('No speech detected. Please try again.');
            }
        } catch (err) {
            console.error('Transcription error:', err);
            showToast('Transcription failed: ' + err.message);
        } finally {
            hideOverlay();
            try { stopSound.play(); } catch (_) { }
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop(); // triggers ondataavailable then onstop
        }
        isRecording = false;
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (isRecording) stopRecording();
            else hideOverlay();
        });
    }

    micBtn.addEventListener('click', async () => {
        // Acting as stop-generating button
        if (micBtn.classList.contains('stop-generating')) {
            stopDisplayFlag = true;
            return;
        }

        // Already recording — stop
        if (isRecording) {
            stopRecording();
            return;
        }

        // Check for MediaDevices support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast('Microphone not supported in this browser. Please use Chrome, Firefox, or Edge.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            try { startSound.play(); } catch (_) { }

            // Pick best supported format
            const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
                .find(t => MediaRecorder.isTypeSupported(t)) || '';

            const options = mimeType ? { mimeType } : {};
            mediaRecorder = new MediaRecorder(stream, options);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                // Stop all microphone tracks so the browser mic indicator goes away
                stream.getTracks().forEach(track => track.stop());

                if (audioChunks.length === 0) {
                    hideOverlay();
                    showToast('No audio recorded.');
                    return;
                }

                const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
                await sendAudioForTranscription(blob);
            };

            mediaRecorder.start(250); // collect chunks every 250ms for reliable data
            isRecording = true;
            showOverlay();

        } catch (err) {
            console.error('Mic access error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showToast('Microphone permission denied. Please allow mic access in your browser settings.');
            } else {
                showToast('Cannot access microphone: ' + err.message);
            }
        }
    });
})();



fileUpload.addEventListener("change", (event) => {
    file = event.target.files[0];
    if (!file) return;
    webSearch.style.display = 'none';
    fileName.textContent = file.name;
    filePreview.classList.remove("hidden");
    showFilePreview(file);
});

textarea.addEventListener("paste", (event) => {
    const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;
    const pastedText = clipboardData ? clipboardData.getData('text') : null;

    if (pastedText && pastedText.trim().length > 300) {
        event.preventDefault();
        pastedLongText = pastedText;
        webSearch.style.display = 'none';

        const previewEl = document.getElementById("pasted-text-preview");
        if (previewEl) {
            previewEl.classList.remove("hidden");
            const textSpan = document.getElementById("pasted-preview-text");
            if (textSpan) textSpan.textContent = pastedLongText;
            textSpan.style.display = '-webkit-box';
        }
        return;
    }

    const items = clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            if (blob) {
                let pastedFile = blob;
                if (!pastedFile.name || pastedFile.name === "image.png") {
                    const ext = blob.type.split('/')[1] || 'png';
                    pastedFile = new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
                }

                file = pastedFile;
                webSearch.style.display = 'none';
                fileName.textContent = file.name;
                filePreview.classList.remove("hidden");
                showFilePreview(file);

                event.preventDefault();
                break;
            }
        }
    }
});

function showFilePreview(file) {
    const textPreviewSpan = document.getElementById('file-preview-text');
    const badge = document.getElementById('file-preview-badge');
    const img = filePreview.querySelector('.preview-thumbnail');

    if (file && file.type.startsWith('image/')) {
        fileName.textContent = file.name;
        fileName.style.display = 'block';
        if (textPreviewSpan) textPreviewSpan.style.display = 'none';
        if (badge) badge.style.display = 'none';

        const reader = new FileReader();
        reader.onload = (e) => {
            if (img) {
                img.src = e.target.result;
                img.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    } else {
        if (img) img.style.display = 'none';
        fileName.style.display = 'none';

        if (textPreviewSpan) {
            textPreviewSpan.style.display = '-webkit-box';
            if (badge) badge.style.display = 'inline-block';

            if (file && file.name === "Pasted content") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    textPreviewSpan.textContent = e.target.result;
                    if (badge) badge.textContent = 'PASTED';
                };
                reader.readAsText(file);
            } else if (file && file.type === "text/plain") {
                const reader = new FileReader();
                reader.onload = (e) => {
                    textPreviewSpan.textContent = e.target.result;
                    if (badge) badge.textContent = 'DOCUMENT';
                };
                reader.readAsText(file);
            } else {
                textPreviewSpan.textContent = file ? file.name : "Document";
                if (badge) badge.textContent = 'FILE';
            }
        }
    }
}

cancelFile.addEventListener('click', () => {
    file = null;
    if (!pastedLongText) webSearch.style.display = 'flex';
    fileUpload.value = '';
    document.getElementById('file-preview').classList.add('hidden');
    const img = document.querySelector('#file-preview .preview-thumbnail');
    if (img) img.style.display = 'none';
});

const cancelPasted = document.getElementById('cancel-pasted');
if (cancelPasted) {
    cancelPasted.addEventListener('click', () => {
        pastedLongText = null;
        if (!file) webSearch.style.display = 'flex';
        document.getElementById('pasted-text-preview').classList.add('hidden');
    });
}





const resizetextarea = document.querySelector('.chat-input textarea');
const maxHeight = 145;
const defaultHeight = 45;
resizetextarea.addEventListener('input', () => {
    resizetextarea.style.height = 'auto';
    const newHeight = Math.min(resizetextarea.scrollHeight, maxHeight);
    resizetextarea.style.height = newHeight + 'px';
    resizetextarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden'; // Enable scroll only at max height
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
    const defaultModel = document.getElementById("user-default-model").value;

    // AI Behavior Settings
    const writingStyle = document.getElementById("user-writing-style")?.value || "";
    const creativity = document.getElementById("user-creativity")?.value || "";
    const interests = document.getElementById("user-interests")?.value || "";
    const customRules = document.getElementById("user-custom-rules")?.value || "";

    const settings = {
        gender,
        ageGroup,
        language,
        culture,
        defaultModel,
        writingStyle,
        creativity,
        interests,
        customRules
    };

    localStorage.setItem("chatSettings", JSON.stringify(settings));
    document.getElementById("settings-modal").classList.remove("show");
    showToast("Preferences saved!");
}


function loadSettings() {
    const savedSettings = localStorage.getItem("chatSettings");
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);


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

        if (settings.defaultModel !== undefined) {
            const modelWrapper = document.getElementById('settings-model-wrapper');
            const input = document.getElementById('user-default-model');
            const display = document.getElementById('settings-model-display');

            if (modelWrapper && input && display) {
                input.value = settings.defaultModel;
                const options = modelWrapper.querySelectorAll('.custom-option');
                options.forEach(opt => {
                    if (opt.getAttribute('data-value') === settings.defaultModel) {
                        display.textContent = opt.textContent;
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });
            }
        }

        // Load AI Behavior settings
        if (settings.writingStyle !== undefined) {
            const wrapper = document.getElementById('writing-style-wrapper');
            const input = document.getElementById('user-writing-style');
            const display = document.getElementById('writing-style-display');
            if (wrapper && input && display) {
                input.value = settings.writingStyle;
                wrapper.querySelectorAll('.custom-option').forEach(opt => {
                    if (opt.getAttribute('data-value') === settings.writingStyle) {
                        display.textContent = opt.textContent;
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });
            }
        }

        if (settings.creativity !== undefined) {
            const wrapper = document.getElementById('creativity-wrapper');
            const input = document.getElementById('user-creativity');
            const display = document.getElementById('creativity-display');
            if (wrapper && input && display) {
                input.value = settings.creativity;
                wrapper.querySelectorAll('.custom-option').forEach(opt => {
                    if (opt.getAttribute('data-value') === settings.creativity) {
                        display.textContent = opt.textContent;
                        opt.classList.add('selected');
                    } else {
                        opt.classList.remove('selected');
                    }
                });
            }
        }

        if (settings.interests) {
            const input = document.getElementById("user-interests");
            if (input) input.value = settings.interests;
        }

        if (settings.customRules) {
            const input = document.getElementById("user-custom-rules");
            if (input) input.value = settings.customRules;
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
            console.log("Settings button clicked");
            e.preventDefault();
            try {
                loadSettings(); // Load saved values
            } catch (err) {
                console.error("Error loading settings:", err);
            }
            settingsModal.classList.add("show");
            if (sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
                document.getElementById("btn1").style.display = "block";
            }
        });
    }

    const settingsForm = document.getElementById("settings-form");
    if (settingsForm) {
        settingsForm.addEventListener("submit", saveSettings);
    }

    const aiBehaviorForm = document.getElementById("ai-behavior-form");
    if (aiBehaviorForm) {
        aiBehaviorForm.addEventListener("submit", saveSettings);
    }

    // Tab switching logic for settings modal
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all tabs and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            // Add active to clicked tab
            btn.classList.add('active');
            // Show corresponding content
            const targetTab = btn.getAttribute('data-tab');
            const contentPane = document.getElementById(`tab-${targetTab}`);
            if (contentPane) contentPane.classList.add('active');
        });
    });

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
    const tempChatBtn = document.getElementById("temp-chat-icon") || document.querySelector(".right-heder-bar .bx-eye-slash");

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
                const token = await getAuthToken();
                const headers = { "Content-Type": "application/json" };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch("${API_BASE_URL}/share", {
                    method: "POST",
                    headers: headers,
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

async function shareChatSession() {
    if (!currentSessionId) {
        showToast("Start a chat to share it!");
        return;
    }

    const email = localStorage.getItem('loggedInUserEmail');
    if (!email) {
        showToast("Please login share.");
        return;
    }

    let shareBtn = document.querySelector(".bx-forward-big");
    if (!shareBtn) {

        shareBtn = document.querySelector(".right-heder-bar .bx-forward-big") || document.querySelector(".bx-share");
    }


    const originalIconClass = shareBtn ? shareBtn.className : "bx bx-forward-big";

    if (shareBtn) {
        shareBtn.className = "bx bx-loader-alt bx-spin";
    }

    try {
        const token = await getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/share`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ email, sessionId: currentSessionId })
        });

        if (!response.ok) throw new Error("Share failed");

        const data = await response.json();
        const shareLink = `${window.location.origin}/share.html?id=${data.shareId}`;

        await navigator.clipboard.writeText(shareLink);
        showToast("Link copied to clipboard!");

        if (shareBtn) shareBtn.className = originalIconClass;

    } catch (error) {
        console.error(error);
        showToast("Failed to generate share link");
        if (shareBtn) shareBtn.className = originalIconClass;
    }
}



async function handleImageGeneration() {
    const prompt = chatInput.value.trim();
    if (!prompt) {
        showToast("Please enter a description for the image first.");
        return;
    }

    // Close the menu if open
    actionsMenu.classList.remove('show');

    // UI Updates similar to ChatHandle
    sendButton.style.display = "none";
    hometagContent.style.display = "none";
    document.getElementById("chat-input").classList.add("hide-before");

    // Create user message in chat
    const userChatLi = createList(prompt, "outgoing");
    chatbox.appendChild(userChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);

    // Clear input
    chatInput.value = "";
    chatInput.style.height = 'auto'; // Reset height

    if (isImageGenMode) {
        isImageGenMode = false;
        if (generateImageBtn) generateImageBtn.classList.remove('active');
        chatInput.placeholder = "Ask anything...";
    }


    const loadingLi = createList(`
   <div class="generated-image-container">
      <div class="premium-image-loader">
        <i class='bx bx-brush'></i>
        <div class="loader-text">Summoning your pixels...</div>
        <div class="loader-bar-container"><div class="loader-bar-fill"></div></div>
      </div>
   </div>
`, "incoming");

    chatbox.appendChild(loadingLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);

    try {
        const token = await getAuthToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/generate-image`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt,
                email: getCurrentUserEmail(),
                sessionId: currentSessionId
            })
        });

        if (!response.ok) {
            throw new Error('Image generation failed');
        }

        const data = await response.json();
        if (data.imageBase64) {
            if (data.imageBase64) {
                // Find the container we created initially
                const container = loadingLi.querySelector('.generated-image-container');
                container.innerHTML = ''; // Clear loading animation

                const img = document.createElement('img');
                img.src = `data:image/png;base64,${data.imageBase64}`;
                img.alt = prompt;
                img.className = 'generated-image';
                img.onclick = () => openImageModal(img.src, prompt);

                const actions = document.createElement('div');
                actions.className = 'image-actions';

                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'action-btn download-btn';
                downloadBtn.innerHTML = "<i class='bx  bx-arrow-to-bottom'></i> ";
                downloadBtn.onclick = () => downloadImage(img.src, prompt);

                const refreshBtn = document.createElement('button');
                refreshBtn.className = 'action-btn refresh-btn';
                refreshBtn.innerHTML = "<i class='bx bx-refresh'></i>";
                refreshBtn.onclick = () => regenerateImage(prompt);

                actions.appendChild(downloadBtn);
                actions.appendChild(refreshBtn);
                container.appendChild(img);
                container.appendChild(actions);

                loadingLi.classList.add('close');
            }


        }

    } catch (error) {
        console.error(error);
        loadingLi.classList.add('error');
        loadingLi.querySelector('.chat-content').textContent = "Failed to generate image. Please try again.";
    }
}

function openImageModal(src, prompt) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById("img-modal-preview");
    const captionText = document.getElementById("image-caption");
    const downloadLink = document.getElementById("modal-download-btn");

    modal.style.display = "block";
    modalImg.src = src;
    captionText.innerHTML = prompt;
    downloadLink.href = src;
    downloadLink.download = `generated-${prompt.substring(0, 20)}.png`;

    const span = document.getElementsByClassName("close-image-modal")[0];
    span.onclick = function () {
        modal.style.display = "none";
    }
    modal.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }
}

if (document.readyState === 'complete') {
    init();
    resetSearchMode();
} else {
    window.addEventListener('load', () => {
        init();
        resetSearchMode();
    });
}

