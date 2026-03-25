import React from 'react';

/**
 * CanvasHeader component
 * Handles the workspace title, actions (close/expand), and tab navigation
 */
const CanvasHeader = ({ title, onClose, onToggleExpand, isExpanded, type, activeTab, setActiveTab, onExport }) => {
    return (
        <div className="canvas-workspace-header">
            <header className="canvas-header">
                <div className="canvas-header-left">
                    <i className='bx bx-dock-right' />
                    <span className="canvas-title">{title}</span>
                </div>
                <div className="canvas-header-right">
                    <button className="canvas-action-btn" title={isExpanded ? "Collapse" : "Expand"} onClick={onToggleExpand}>
                        <i className={`bx ${isExpanded ? 'bx-collapse' : 'bx-expand'}`} />
                    </button>
                    <button className="canvas-close-btn" onClick={onClose} title="Close Canvas">
                        <i className='bx bx-x' />
                    </button>
                </div>
            </header>

            {type === 'frontend' && (
                <nav className="canvas-tabs">
                    <div className="tabs-left">
                        <button 
                            className={`canvas-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preview')}
                        >
                            <i className='bx bx-desktop' /> Preview
                        </button>
                        <button 
                            className={`canvas-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                            onClick={() => setActiveTab('code')}
                        >
                            <i className='bx bx-code-alt' /> Code
                        </button>
                    </div>
                    <div className="tabs-right">
                        <button className="canvas-tab-btn download-all" onClick={onExport}>
                            <i className='bx bx-download' /> Export
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
};

export default CanvasHeader;
