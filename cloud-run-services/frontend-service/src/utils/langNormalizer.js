/**
 * Language Normalizer for highlight.js
 * 
 * Prevents errors from partial, misspelled, or unknown language names
 * during streaming and session reloads. Returns a valid hljs language
 * name or 'plaintext' as a safe fallback.
 */

// Common aliases and corrections for language names
const LANG_ALIASES = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'zsh': 'bash',
    'yml': 'yaml',
    'md': 'markdown',
    'html5': 'html',
    'htm': 'html',
    'cs': 'csharp',
    'c++': 'cpp',
    'cc': 'cpp',
    'h': 'cpp',
    'hpp': 'cpp',
    'objc': 'objectivec',
    'objective-c': 'objectivec',
    'kt': 'kotlin',
    'rs': 'rust',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'react': 'javascript',
    'vue': 'xml',
    'svelte': 'xml',
    'dockerfile': 'docker',
    'text': 'plaintext',
    'txt': 'plaintext',
    'plain': 'plaintext',
    'ps1': 'powershell',
    'psm1': 'powershell',
    'bat': 'dos',
    'cmd': 'dos',
    'tf': 'hcl',
    'env': 'ini',
    'conf': 'ini',
    'cfg': 'ini',
    'toml': 'ini',
    'proto': 'protobuf',
    'gql': 'graphql',
    'asm': 'x86asm',
    'nasm': 'x86asm',
    'masm': 'x86asm',
};

// Known valid hljs languages (the most common ones) — used for prefix matching
const KNOWN_LANGUAGES = [
    'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c',
    'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'php', 'perl',
    'bash', 'powershell', 'sql', 'html', 'xml', 'css', 'scss', 'less',
    'json', 'yaml', 'markdown', 'plaintext', 'diff', 'makefile',
    'docker', 'nginx', 'apache', 'ini', 'lua', 'r', 'matlab',
    'objectivec', 'dart', 'elixir', 'erlang', 'haskell', 'clojure',
    'fsharp', 'vbnet', 'coffeescript', 'groovy', 'graphql', 'protobuf',
    'latex', 'arduino', 'arm', 'x86asm', 'wasm', 'dos', 'hcl',
];

/**
 * Normalize a language label to a valid highlight.js language.
 * Handles partial names (from streaming), aliases, and unknown languages.
 * 
 * @param {string} lang - The raw language label from a code fence
 * @returns {string} A valid hljs language name, or 'plaintext'
 */
export function normalizeLang(lang) {
    if (!lang) return 'plaintext';

    const lower = lang.toLowerCase().trim();
    if (!lower) return 'plaintext';

    // 1. Check direct alias match
    if (LANG_ALIASES[lower]) return LANG_ALIASES[lower];

    // 2. Check if hljs recognizes it directly (runtime check)
    if (typeof window !== 'undefined' && window.hljs && window.hljs.getLanguage(lower)) {
        return lower;
    }

    // 3. Try prefix matching — handles streaming partials like "javascri" or "typescr"
    //    Only match if the partial is at least 3 chars to avoid false positives
    if (lower.length >= 3) {
        const match = KNOWN_LANGUAGES.find(known => known.startsWith(lower));
        if (match) {
            // Verify the match is reasonable (partial must be >50% of full name)
            if (lower.length >= match.length * 0.5) {
                return match;
            }
        }
    }

    // 4. Fallback: plaintext — no errors, no warnings
    return 'plaintext';
}
