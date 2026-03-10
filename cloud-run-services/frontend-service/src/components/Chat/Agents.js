// ── src/config/agents.js ──────────────────────────────────────────────────────
// Single source of truth for every agent.
// Add a new agent here → it automatically appears in the sidebar,
// the Apps modal (with full About section), and the agent router.
// ─────────────────────────────────────────────────────────────────────────────

import ExcelAgent from '../components/ExcelAgent/ExcelAgent';
import WordAgent  from '../components/WordAgent/WordAgent';
// import PdfAgent   from '../components/PdfAgent/PdfAgent';   // future
// import ImageAgent from '../components/ImageAgent/ImageAgent'; // future

export const AGENTS = [
    // ── Excel ────────────────────────────────────────────────────────────────
    {
        id:          'excel',
        name:        'Excel Agent',
        icon:        'bx-spreadsheet',
        color:       '#22c55e',
        badge:       'AI',
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
        color:       '#2563eb',
        badge:       'AI',
        description: 'Upload .docx or .txt files and let AI write, rewrite, summarize, and format your documents.',
        component:   WordAgent,
        about: {
            summary: `The Word Agent is an AI-powered document editor that reads, rewrites,
and formats your documents in real time. Upload a .docx or .txt file —
or start from a blank page — and let AI do the heavy lifting.`,
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
                    desc:  'Download your finished document as a .txt file (DOCX export coming soon).',
                },
            ],
        },
    },

    // ── PDF (future) ──────────────────────────────────────────────────────────
    // {
    //     id:          'pdf',
    //     name:        'PDF Agent',
    //     icon:        'bxs-file-pdf',
    //     color:       '#ef4444',
    //     badge:       'Soon',
    //     description: 'Read, summarize, and annotate PDF documents with AI.',
    //     component:   null,   // swap for PdfAgent when ready
    //     about: {
    //         summary: `The PDF Agent lets you chat with any PDF document.
    // Extract key insights, highlight important sections, and export summaries.`,
    //         features: [
    //             { icon: 'bx-search-alt', title: 'Smart Search',    desc: 'Ask questions and get answers sourced directly from the PDF.' },
    //             { icon: 'bx-highlight',  title: 'Auto Highlight',  desc: 'AI highlights the most important passages for you.' },
    //             { icon: 'bx-list-check', title: 'Summarize',       desc: 'Get a concise summary of any PDF in seconds.' },
    //             { icon: 'bx-download',   title: 'Export Notes',    desc: 'Export highlights and summaries as a clean text file.' },
    //         ],
    //     },
    // },
];