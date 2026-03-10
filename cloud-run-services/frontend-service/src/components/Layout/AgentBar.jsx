import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const AGENTS = [
    { id: 'chat', icon: 'bx-chat', label: 'Chat', tip: 'Chat Agent' },
    { id: 'excel', icon: 'bx-spreadsheet', label: 'Excel Agent', tip: 'Excel Assistant' },
    // future agents go here
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
                    <i className={`bx ${agent.icon}`} />
                </button>
            ))}

            <div className="agent-bar-spacer" />
        </div>
    );
}
