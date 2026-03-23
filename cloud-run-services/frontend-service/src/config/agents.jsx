import ExcelAgent from '../components/ExcelAgent/ExcelAgent';
import WordAgent from '../components/WordAgent/WordAgent';
import CanvaAgent from '../components/CanvaAgent/CanvaAgent';
import GmailAgent from '../components/GmailAgent/GmailAgent';
import GoogleDriveAgent from '../components/GoogleDriveAgent/GoogleDriveAgent';

export const AGENTS = [
    {
        id: 'chat',
        name: 'Chat',
        icon: 'bx-chat',
        description: 'General purpose AI assistant',
        component: null,
    },
    {
        id: 'excel',
        name: 'Excel Agent',
        icon: 'bx-spreadsheet',
        description: 'AI Spreadsheet Editor',
        component: ExcelAgent,
        color: '#22c55e',
        badge: 'MVP',
        hideInSidebar: true,
    },
    {
        id: 'word',
        name: 'Word Agent',
        icon: 'bxs-file-doc',
        description: 'AI Document Editor',
        component: WordAgent,
        color: '#3b82f6',
        badge: 'MVP',
        hideInSidebar: true,
    },
    {
        id: 'canva',
        name: 'Canva Agent',
        icon: 'bx-brush',
        description: 'AI design canvas for slides and layouts',
        component: CanvaAgent,
        color: '#ec4899',
        badge: 'NEW',
        hideInSidebar: true,
    },
    {
        id: 'gmail',
        name: 'Gmail Agent',
        icon: 'bx-envelope',
        description: 'Draft, search, and summarize Gmail threads',
        component: GmailAgent,
        color: '#ef4444',
        badge: 'BETA',
        hideInSidebar: true,
    },
    {
        id: 'google_drive',
        name: 'Drive Agent',
        icon: 'bx-folder-open',
        description: 'Manage and search Google Drive with AI',
        component: GoogleDriveAgent,
        color: '#f59e0b',
        badge: 'BETA',
        hideInSidebar: true,
    },
    {
        id: 'browser_automation',
        name: 'Browser Automation',
        icon: 'bx-globe',
        description: 'Runs browser tasks from chat tools and backend services',
        component: null,
        color: '#8b5cf6',
        badge: 'SERVICE',
        launchable: false,
        hideInSidebar: true,
    },
];

export const getAgentById = (id) => AGENTS.find(a => a.id === id) || AGENTS[0];
