import { AGENTS } from '../Chat/Agents';

export default function AgentBar({ activeAgent, onAgentChange }) {
    return (
        <div className="agent-bar">
            {/* Logo Section */}
            <div className="agent-bar-logo" style={{ marginBottom: '20px' }}>
                <i className='bx bx-doughnut-chart' style={{ fontSize: '24px', color: 'var(--accent)' }} />
            </div>

            {/* Navigation Section */}
            <div className="agent-nav-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {AGENTS.filter(a => !a.hideInSidebar).map(agent => (
                    <button
                        key={agent.id}
                        className={`agent-btn ${activeAgent === agent.id ? 'active' : ''}`}
                        onClick={() => onAgentChange(agent.id)}
                        data-tip={agent.name}
                        title={agent.name}
                        style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: activeAgent === agent.id ? 'var(--sarvam-bg-elevated)' : 'transparent',
                            border: activeAgent === agent.id ? '1px solid var(--sarvam-border)' : '1px solid transparent',
                            color: activeAgent === agent.id ? (agent.color || 'var(--accent)') : 'var(--sarvam-text-secondary)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                    >
                        {agent.logo ? (
                            <img 
                                src={agent.logo} 
                                alt={agent.name} 
                                style={{ 
                                    width: '24px', 
                                    height: '24px', 
                                    objectFit: 'contain',
                                    filter: activeAgent === agent.id ? 'none' : 'grayscale(1) opacity(0.7)'
                                }} 
                            />
                        ) : (
                            <i className={`bx ${agent.icon}`} style={{ fontSize: '20px' }} />
                        )}
                    </button>
                ))}
            </div>

            <div className="agent-bar-spacer" />
        </div>
    );
}
