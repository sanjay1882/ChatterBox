import ExcelAgent from '../components/ExcelAgent/ExcelAgent';
import WordAgent from '../components/WordAgent/WordAgent';

export const AGENTS = [
    {
        id: 'chat',
        name: 'Chat',
        icon: 'bx-chat',
        description: 'General Purpose AI',
        component: null, // Default chat view is handled by ChatApp
    },
    {
        id: 'excel',
        name: 'Excel Agent',
        icon: 'bx-spreadsheet',
        description: 'AI Spreadsheet Editor',
        component: ExcelAgent,
        color: '#22c55e',
        badge: 'MVP',
        hideInSidebar: true, // moved to Apps panel
    },
    // Future agents can be added here easily
    {
        id: 'word',
        name: 'Word Agent',
        icon: 'bxs-file-doc',
        description: 'AI Document Editor',
        component: WordAgent,
        color: '#3b82f6',
        badge: 'MVP',
        hideInSidebar: true, // Show in apps
    }
    /*
    {
        id: 'sql',
        name: 'Database Agent',
        icon: 'bx-data',
        description: 'Natural Language to SQL',
        component: SQLAgent,
    }
    */
];

export const getAgentById = (id) => AGENTS.find(a => a.id === id) || AGENTS[0];
