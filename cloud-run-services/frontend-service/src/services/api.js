const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000');

// ── Stream Chat ─────────────────────────────────────────────────────────────
export async function streamChat({ formData, token, onChunk, onSessionId, onEnd, onError, onSources, onBrowserResult, onAppCommand, onImages }) {
    try {
        const headers = {};
        if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/stream`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Server error' }));
            onError?.(err.error || res.statusText);
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = 'message'; // default event type

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                // Track the event type for the next data line
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                    continue;
                }

                if (line === '') {
                    // blank line resets event type
                    currentEvent = 'message';
                    continue;
                }

                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw || raw === '[DONE]') continue;

                // Handle named events
                if (currentEvent === 'end') { onEnd?.(); currentEvent = 'message'; continue; }
                if (currentEvent === 'error') {
                    try { onError?.(JSON.parse(raw).error || raw); } catch { onError?.(raw); }
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'sources') {
                    try { onSources?.(JSON.parse(raw)); } catch { }
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'session_id') {
                    onSessionId?.(raw);
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'browser_result') {
                    try { onBrowserResult?.(JSON.parse(raw)); } catch { }
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'app_command') {
                    try { onAppCommand?.(JSON.parse(raw)); } catch { }
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'images') {
                    try { onImages?.(JSON.parse(raw)); } catch { }
                    currentEvent = 'message'; continue;
                }
                if (currentEvent === 'message_ids') {
                    currentEvent = 'message'; continue;
                }

                try {
                    const json = JSON.parse(raw);
                    // Handle various backends (some use sid/sessionId, some use text/chunk)
                    if (json.sessionId || json.sid) onSessionId?.(json.sessionId || json.sid);
                    if (json.chunk || json.text) onChunk?.(json.chunk || json.text);
                    if (json.error) onError?.(json.error);
                } catch {
                    // Only pass as text if it doesn't look like a partial JSON object
                    if (!raw.startsWith('{')) {
                        if (raw.length === 24 && /^[0-9a-fA-F]{24}$/.test(raw)) {
                            onSessionId?.(raw);
                        } else {
                            onChunk?.(raw);
                        }
                    }
                }
            }
        }
        onEnd?.();
    } catch (err) {
        onError?.(err.message);
    }
}

// ── Get Sessions ─────────────────────────────────────────────────────────────
export async function getSessions(email, token, page = 1) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/sessions/${email}?page=${page}&limit=20`, { headers });
    if (!res.ok) throw new Error('Failed to fetch sessions');
    return res.json();
}

// ── Get Single Session ────────────────────────────────────────────────────────
export async function getSession(email, sessionId, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/session/${email}/${sessionId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
}

// ── Delete Session ────────────────────────────────────────────────────────────
export async function deleteSession(email, sessionId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/session/${email}/${sessionId}/soft-delete`, {
        method: 'PATCH',
        headers,
    });
    if (!res.ok) throw new Error('Failed to delete session');
    return res.json();
}

// ── Share Session ─────────────────────────────────────────────────────────────
export async function toggleSessionShare(email, sessionId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/session/${email}/${sessionId}/share`, {
        method: 'POST',
        headers,
    });
    if (!res.ok) throw new Error('Failed to share session');
    return res.json();
}

// ── Get Public Session ────────────────────────────────────────────────────────
export async function getPublicSession(sessionId) {
    const res = await fetch(`${API_BASE_URL}/session/public/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch public session or session not shared');
    return res.json();
}

// ── Excel Agent ───────────────────────────────────────────────────────────────
export async function excelAgentStream({ message, sheetData, token, email, onChunk, onData, onJobQueued }) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/excel-agent`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, sheetData, email }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Server error' }));
            throw new Error(err.error || res.statusText);
        }

        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            if (data.jobId) {
                onJobQueued?.(data.jobId, data.message);
                return;
            }
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                try {
                    const json = JSON.parse(raw);
                    // Handle Fast API style chunks which may just be chunks of text
                    if (json.chunk) onChunk?.(json.chunk);
                    // Fast api also sends standard text chunks
                    if (json.text) onChunk?.(json.text);
                    if (json.done) onData?.(json);
                    if (json.error) throw new Error(json.error);
                } catch (e) {
                    // Try parsing as raw event if it is a python string yield
                    if (!raw.startsWith('{')) {
                        if (raw.length === 24 && /^[0-9a-fA-F]{24}$/.test(raw)) {
                            // Backend sends unquoted MongoDB _id for sessions
                        } else {
                            onChunk?.(raw);
                        }
                    } else {
                        console.warn("Stream line parse fail:", line, e);
                    }
                }
            }
        }
    } catch (err) {
        throw err;
    }
}

// ── User Preferences ──────────────────────────────────────────────────────────
export async function getUserPreferences(email, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/user/preferences/${email}`, { headers });
    if (!res.ok) return null;
    return res.json();
}

export async function saveUserPreferences(email, token, prefs) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/user/preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, ...prefs }),
    });
    if (!res.ok) return null;
    return res.json();
}

export async function generateImage(prompt, email, sessionId, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, email, sessionId }),
    });
    if (!res.ok) {
        throw new Error('Image generation failed');
    }
    return res.json();
}

export async function getGallery(email, token) {
    const headers = {};
    if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/gallery/${encodeURIComponent(email)}`, { headers });
    if (!res.ok) return { images: [] };
    return res.json();
}

// ── Word Agent ───────────────────────────────────────────────────────────────
export async function wordAgentStream({ message, docContent, fileName, token, email, onChunk, onData }) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/word-agent`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ message, docContent, fileName, email }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Server error' }));
            throw new Error(err.error || res.statusText);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                try {
                    const json = JSON.parse(raw);
                    // Handle Fast API style chunks which may just be chunks of text
                    if (json.chunk) onChunk?.(json.chunk);
                    // Fast api also sends standard text chunks
                    if (json.text) onChunk?.(json.text);
                    if (json.done) onData?.(json);
                    if (json.error) throw new Error(json.error);
                } catch (e) {
                    // Try parsing as raw event if it is a python string yield
                    if (!raw.startsWith('{')) {
                        if (raw.length === 24 && /^[0-9a-fA-F]{24}$/.test(raw)) {
                            // Backend sends unquoted MongoDB _id for sessions
                        } else {
                            onChunk?.(raw);
                        }
                    } else {
                        console.warn("Stream line parse fail:", line, e);
                    }
                }
            }
        }
    } catch (err) {
        throw err;
    }
}

async function streamAgentEndpoint(endpoint, { body, token, onChunk, onData, onSessionId }) {
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || res.statusText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = 'message';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
            }

            if (line === '') {
                currentEvent = 'message';
                continue;
            }

            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]' || raw === 'done') continue;

            if (currentEvent === 'session_id') {
                onSessionId?.(raw.replace(/^"|"$/g, ''));
                currentEvent = 'message';
                continue;
            }

            try {
                const json = JSON.parse(raw);
                if (json.sessionId || json.sid) onSessionId?.(json.sessionId || json.sid);
                if (json.chunk) onChunk?.(json.chunk);
                if (json.text) onChunk?.(json.text);
                if (json.fullMessage || json.patch || json.actions || json.operation || json.done || json.error || json.deckRestore || json.slideOps) {
                    onData?.(json);
                }
                if (json.error) throw new Error(json.error);
            } catch (e) {
                if (!raw.startsWith('{')) {
                    onChunk?.(raw);
                } else {
                    console.warn('Agent stream parse failure:', line, e);
                }
            }
        }
    }
}

export async function canvaAgentStream({ message, slideContext, token, email, sessionId, onChunk, onData, onSessionId }) {
    return streamAgentEndpoint('/canva-agent', {
        body: { message, slideContext, email, sessionId },
        token,
        onChunk,
        onData,
        onSessionId,
    });
}

export async function gmailAgentStream({ message, emails, token, email, googleAccessToken, sessionId, settings, onChunk, onData, onSessionId }) {
    return streamAgentEndpoint('/gmail-agent', {
        body: { message, emails, email, googleAccessToken, sessionId, settings },
        token,
        onChunk,
        onData,
        onSessionId,
    });
}

export async function googleDriveAgentStream({ message, driveContent, conversationHistory, token, email, googleAccessToken, sessionId, settings, onChunk, onData, onSessionId }) {
    return streamAgentEndpoint('/google-drive-agent', {
        body: { message, driveContent, conversationHistory, email, googleAccessToken, sessionId, settings },
        token,
        onChunk,
        onData,
        onSessionId,
    });
}

export async function browserAutomationTask({ token, taskType, url = '', options = {}, sessionId = '' }) {
    const headers = { 'Content-Type': 'application/json' };
    if (token && token !== 'guest') headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/browser-automation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskType, url, options, sessionId }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.error || 'Browser automation request failed');
    }
    return json;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function updateTheme(token, theme) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/settings/theme`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ theme }),
    });
    if (!res.ok) throw new Error('Failed to update theme');
    return res.json();
}

export async function updateVoice(token, voiceEnabled, voice) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/settings/voice`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ voiceEnabled, voice }),
    });
    if (!res.ok) throw new Error('Failed to update voice');
    return res.json();
}

export async function updateModel(token, defaultModel) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/settings/model`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ defaultModel }),
    });
    if (!res.ok) throw new Error('Failed to update model');
    return res.json();
}

