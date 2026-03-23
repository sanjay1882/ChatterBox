import { AGENTS as CONFIG_AGENTS } from '../../config/agents';

// Merge or use the central AGENTS config. 
// Note: AgentBar seems to specific only a subset but let's make it consistent.
const AGENTS = [
    { id: 'chat', icon: 'bx-chat', label: 'Chat', tip: 'Chat Agent' },
    ...CONFIG_AGENTS.map(a => ({ id: a.id, icon: a.icon, logo: a.logo, label: a.name, tip: a.name }))
];

export default function AgentBar({ activeAgent, onAgentChange }) {
    return (
        <div className="agent-bar">
            <div className="agent-bar-logo">
                <i className='bx bx-doughnut-chart' />
            </div>

            {AGENTS.map(agent => (
                <button
                    key={agent.id}
                    className={`agent-btn ${activeAgent === agent.id ? (agent.id === 'excel' ? 'excel-active' : 'active') : ''}`}
                    onClick={() => onAgentChange(agent.id)}
                    data-tip={agent.tip}
                    title={agent.tip}
                >
                    {agent.logo ? (
                        <img 
                            src={agent.logo} 
                            alt={agent.label} 
                            style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
                        />
                    ) : (
                        <i className={`bx ${agent.icon}`} />
                    )}
                </button>
            ))}

            <div className="agent-bar-spacer" />
        </div>
    );
}
