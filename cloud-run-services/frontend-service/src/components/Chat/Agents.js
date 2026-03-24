// ── src/config/agents.js ──────────────────────────────────────────────────────
// Single source of truth for every agent.
// Add a new agent here → it automatically appears in the sidebar,
// the Apps modal (with full About section), and the agent router.
// ─────────────────────────────────────────────────────────────────────────────

import ExcelAgent from '../ExcelAgent/ExcelAgent';
import WordAgent  from '../WordAgent/WordAgent';
import CanvaAgent from '../CanvaAgent/CanvaAgent';
import GmailAgent from '../GmailAgent/GmailAgent';
import GoogleDriveAgent from '../GoogleDriveAgent/GoogleDriveAgent';


export const AGENTS = [
    // ── Excel ────────────────────────────────────────────────────────────────
    {
        id:          'excel',
        name:        'Excel Agent',
        icon:        'bx-spreadsheet',
        logo:        'https://img.icons8.com/color/48/microsoft-excel-2019--v1.png',
        color:       '#22c55e',
        badge:       'AI',
        hideInSidebar: true,
        description: 'Upload CSV or XLSX files and let AI edit, sort, filter, and format your data instantly.',
        component:   ExcelAgent,
        about: {
            summary: `The Excel Agent is a powerful spreadsheet assistant powered by AI.
It can analyze your CSV and XLSX files, write complex formulas,
highlight outliers, and format your data — all in plain English.`,
            features: [
                {
                    icon:  'bx-math',
                    title: 'Smart Formulas',
                    desc:  'Describe what you need in plain English and get the right formula instantly.',
                },
                {
                    icon:  'bx-bar-chart-alt-2',
                    title: 'Data Analysis',
                    desc:  'Summarize large datasets, spot trends, and surface outliers automatically.',
                },
                {
                    icon:  'bx-palette',
                    title: 'Visual Formatting',
                    desc:  'Apply colors, highlight rows, and style cells based on conditions.',
                },
                {
                    icon:  'bx-layer',
                    title: 'Multi-sheet Support',
                    desc:  'Open multiple files with multiple sheets and switch between them seamlessly.',
                },
                {
                    icon:  'bx-undo',
                    title: 'Undo / Redo',
                    desc:  'Full history so you can roll back any AI or manual change.',
                },
                {
                    icon:  'bx-download',
                    title: 'Export to XLSX',
                    desc:  'Download your edited spreadsheet as a fully formatted Excel file.',
                },
            ],
        },
    },

    // ── Word ─────────────────────────────────────────────────────────────────
    {
        id:          'word',
        name:        'Word Agent',
        icon:        'bxs-file-doc',
        logo:        'https://img.icons8.com/color/48/microsoft-word-2025.png',
        color:       '#2563eb',
        badge:       'AI',
        hideInSidebar: true,
        description: 'Upload .docx or .txt files and let AI write, rewrite, summarize, and format your documents.',
        component:   WordAgent,
        about: {
            summary: `The Word Agent is an AI-powered document editor that reads, rewrites,
and formats your documents in real time. Upload a .docx or .txt file —
or start from a blank page — and let AI do the heavy lifting.
Whether you need a polished report, a clean summary, or a full rewrite,
the Word Agent handles it all through simple plain-English instructions.`,
            features: [
                {
                    icon:  'bx-edit-alt',
                    title: 'Smart Editing',
                    desc:  'Fix grammar, rewrite sections, or change tone — just ask in plain English.',
                },
                {
                    icon:  'bx-list-ul',
                    title: 'Summarize & Expand',
                    desc:  'Condense long documents into bullet points or expand notes into full prose.',
                },
                {
                    icon:  'bx-columns',
                    title: 'Live Preview',
                    desc:  'Switch between Edit, Split, and Preview modes to see changes instantly.',
                },
                {
                    icon:  'bx-file-blank',
                    title: 'Multi-file Tabs',
                    desc:  'Open multiple documents at once and switch between them with tabs.',
                },
                {
                    icon:  'bx-undo',
                    title: 'Undo / Redo',
                    desc:  'Full history — roll back any AI or manual edit with Ctrl+Z.',
                },
                {
                    icon:  'bx-download',
                    title: 'Export',
                    desc:  'Download your finished document as a .txt or .docx file with one click.',
                },
            ],
        },
    },

    // ── Google Drive ─────────────────────────────────────────────────────────
    {
        id:          'googledrive',
        name:        'Google Drive',
        icon:        'bxl-google-cloud',
        logo:        'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg',
        color:       '#34a853',
        badge:       'Live',
        requiresGoogle: true,
        hideInSidebar: true,
        component:   GoogleDriveAgent,
        description: 'Access, search, and summarize your Google Drive files directly from the chat.',
        about: {
            summary: `The Google Drive Agent connects directly to your cloud storage,
letting you search, read, and summarize documents without ever leaving the chat.
Ask questions about your files, pull key information from Docs or Sheets,
and keep your workflow moving — no tab-switching required.
Simply connect your Google account and your Drive is instantly accessible.`,
            features: [
                {
                    icon:  'bx-search',
                    title: 'File Search',
                    desc:  'Find any file by name, type, or keyword across your entire Drive instantly.',
                },
                {
                    icon:  'bx-time-five',
                    title: 'Quick Access',
                    desc:  'Open and read your most recently modified documents with a single prompt.',
                },
                {
                    icon:  'bx-list-check',
                    title: 'AI Summaries',
                    desc:  'Get concise summaries of long Docs, Sheets, or Slides without opening them.',
                },
                {
                    icon:  'bx-folder-open',
                    title: 'Folder Navigation',
                    desc:  'Browse folders and subfolders and understand your file structure at a glance.',
                },
                {
                    icon:  'bx-link',
                    title: 'Shareable Links',
                    desc:  'Retrieve sharing links for any file so you can send them directly from chat.',
                },
                {
                    icon:  'bx-lock-alt',
                    title: 'Secure Access',
                    desc:  'Read-only by default — your files are never modified without your explicit request.',
                },
            ],
        },
    },

    // ── Gmail ─────────────────────────────────────────────────────────────────
    {
        id:          'gmail',
        name:        'Gmail',
        icon:        'bxs-envelope',
        logo:        'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
        color:       '#ea4335',
        badge:       'Live',
        requiresGoogle: true,
        hideInSidebar: true,
        component:   GmailAgent,
        description: 'Read, search, and draft emails with AI assistance right inside the chat.',
        about: {
            summary: `The Gmail Agent brings your inbox into the conversation.
Search for emails by sender, subject, or keyword, get instant thread summaries,
and draft polished replies — all without opening a new tab.
Whether you're triaging a busy inbox or writing a careful response,
the Gmail Agent saves you time at every step.`,
            features: [
                {
                    icon:  'bx-search-alt',
                    title: 'Inbox Search',
                    desc:  'Find emails by sender, subject, date range, or keyword in seconds.',
                },
                {
                    icon:  'bx-envelope-open',
                    title: 'Thread Summaries',
                    desc:  'Get a quick summary of any long email chain without reading every message.',
                },
                {
                    icon:  'bx-mail-send',
                    title: 'Draft Replies',
                    desc:  'Generate professional, context-aware responses ready to send in one click.',
                },
                {
                    icon:  'bx-label',
                    title: 'Label & Filter Insights',
                    desc:  'Understand how your labels and filters are organized and find messages faster.',
                },
                {
                    icon:  'bx-bell',
                    title: 'Priority Detection',
                    desc:  'AI flags urgent or action-required emails so nothing important slips through.',
                },
                {
                    icon:  'bx-shield-quarter',
                    title: 'Privacy First',
                    desc:  'Email content is only read when you ask — never stored or used for training.',
                },
            ],
        },
    },

    // ── Canva ─────────────────────────────────────────────────────────────────
    {
        id:          'canva',
        name:        'Canva Agent',
        icon:        'bx-brush',
        logo:        'https://img.icons8.com/fluency/96/canva.png',
        color:       '#ec4899',
        badge:       'NEW',
        hideInSidebar: true,
        component:   CanvaAgent,
        description: 'Design beautiful slides, social posts, and layouts using AI — no design skills needed.',
        about: {
            summary: `The Canva Agent is your AI-powered design partner.
Describe what you want to create — a pitch deck, a social post, a flyer —
and watch it come to life with smart layouts, on-brand colors, and generated assets.
No design experience needed. Just tell the agent what you have in mind
and it handles typography, spacing, and visual hierarchy for you.`,
            features: [
                {
                    icon:  'bx-paint',
                    title: 'Smart Layouts',
                    desc:  'Auto-arrange text, images, and elements for maximum visual impact.',
                },
                {
                    icon:  'bx-image-add',
                    title: 'AI Assets',
                    desc:  'Generate custom images, icons, and illustrations on the fly.',
                },
                {
                    icon:  'bx-palette',
                    title: 'Brand Theming',
                    desc:  'Apply consistent colors, fonts, and styles across your entire design.',
                },
                {
                    icon:  'bx-slideshow',
                    title: 'Slide Decks',
                    desc:  'Build polished multi-slide presentations from a simple outline or prompt.',
                },
                {
                    icon:  'bx-mobile-alt',
                    title: 'Multi-format Export',
                    desc:  'Export your design as PNG, PDF, or MP4 — optimized for any platform.',
                },
                {
                    icon:  'bx-history',
                    title: 'Version History',
                    desc:  'Revisit and restore any previous version of your design at any time.',
                },
            ],
        },
    },

    // ── Browser Automation ────────────────────────────────────────────────────
    {
        id:          'browser_automation',
        name:        'Browser Automation',
        icon:        'bx-globe',
        color:       '#8b5cf6',
        badge:       'SERVICE',
        logo:        'https://img.icons8.com/color/48/open-in-browser.png',
        component:   null,
        launchable:  false,
        hideInSidebar: true,
        description: 'Runs browser tasks from chat tools and backend services',
        about: {
            summary: `The Browser Automation agent is the infrastructure layer that powers
web searching, scraping, and automation tasks across the platform.
It runs headless browser sessions in a managed, sandboxed environment
so other agents can retrieve live web data, fill forms, and interact
with web apps — securely and reliably behind the scenes.`,
            features: [
                {
                    icon:  'bx-cloud',
                    title: 'Cloud Runner',
                    desc:  'Executes browser scripts in a fully managed cloud environment.',
                },
                {
                    icon:  'bx-lock-alt',
                    title: 'Sandboxed Sessions',
                    desc:  'Every browser session is isolated for security and privacy.',
                },
                {
                    icon:  'bx-globe',
                    title: 'Live Web Data',
                    desc:  'Fetch real-time information from any publicly accessible web page.',
                },
                {
                    icon:  'bx-bot',
                    title: 'Headless Automation',
                    desc:  'Automate multi-step web interactions without any manual intervention.',
                },
                {
                    icon:  'bx-tachometer',
                    title: 'Fast Execution',
                    desc:  'Optimized for low-latency responses so other agents are never kept waiting.',
                },
                {
                    icon:  'bx-plug',
                    title: 'Agent Integration',
                    desc:  'Seamlessly invoked by other agents — no manual setup or configuration needed.',
                },
            ],
        },
    },
];

export const getAgentById = (id) => AGENTS.find(a => a.id === id) || AGENTS[0];
