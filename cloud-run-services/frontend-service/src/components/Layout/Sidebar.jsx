import React from 'react';
import { Link } from 'react-router-dom';
import { AGENTS } from '../../config/agents';

// Skeleton shimmer for conversation loading
function ConversationSkeleton() {
    return (
        <div className="conv-skeleton-list">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="conv-skeleton-item" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="conv-skel-line long" />
                </div>
            ))}
        </div>
    );
}

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    onResize,
    user,
    logout,
    isGuest,
    appMode,
    setAppMode,
    searchQuery,
    setSearchQuery,
    startNewChat,
    filteredSessions,
    sessionId,
    currentSessionId,
    setCurrentSessionId,
    setDeleteModal,
    sessHasMore,
    sessionsLoading,
    loadSessions,
    sessPage,
    setSettingsOpen,
    setAppsOpen,
    onOpenLegal,
    galleryCount = 0,
    onOpenGallery,
}) {
    const isResizing = React.useRef(false);

    const startResizing = React.useCallback((mouseDownEvent) => {
        isResizing.current = true;
        document.addEventListener('mousemove', handleResizing);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const handleResizing = React.useCallback((mouseMoveEvent) => {
        if (isResizing.current) {
            onResize(mouseMoveEvent.clientX);
        }
    }, [onResize]);

    const stopResizing = React.useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResizing);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [handleResizing]);

    return (
        <div 
            className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}
            style={sidebarOpen && window.innerWidth > 768 ? { width: `${sidebarWidth}px` } : {}}
        >
            <div className="logo-details">
                {!sidebarOpen ? (
                   <i className='bx bx-doughnut-chart' onClick={() => setSidebarOpen(true)} style={{ cursor: 'pointer' }} data-tooltip="Treevit" />
                ) : (
                    <>
                        <i className='bx bx-doughnut-chart' />
                        
                    </>
                )}
                <i 
                    className={`bx ${sidebarOpen ? 'bx-menu-alt-right' : 'bx-menu'}`} 
                    id="btn" 
                    onClick={() => setSidebarOpen(!sidebarOpen)} 
                    data-tooltip={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                />
            </div>

            <ul className="nav-list">
                {/* Search - Hidden in collapsed */}
                {sidebarOpen && (
                    <li>
                        <div className="sidebar-search-container">
                            <div className="sidebar-search">
                            
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    id="sidebar-search-input"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </li>
                )}

                {/* New Chat */}
                <li className="Newchat-Btn">
                    <a href="#" onClick={e => { e.preventDefault(); startNewChat(); }} data-tooltip="New Chat">
                        <i className='bx bx-plus' />
                        <span className="links_name">New Chat</span>
                    </a>
                </li>

                {/* Gallery - Hidden in collapsed */}
                {sidebarOpen && (
                    <li>
                        <a
                            href="#"
                            id="gallery-btn"
                            onClick={e => { e.preventDefault(); onOpenGallery?.(); if(window.innerWidth <= 768) setSidebarOpen(false); }}
                            data-tooltip="Gallery"
                        >
                            <i className='bx bx-images' />
                            <span className="links_name">
                                Gallery
                                {galleryCount > 0 && (
                                    <span className="gallery-badge">{galleryCount}</span>
                                )}
                            </span>
                        </a>
                    </li>
                )}

                {/* Apps */}
                <li>
                    <a href="#" id="apps-btn" onClick={e => {
                        e.preventDefault();
                        setAppsOpen(true);
                        if(window.innerWidth <= 768) setSidebarOpen(false);
                    }} data-tooltip="Apps Explorer">
                        <i className='bx bx-grid-alt' />
                        <span className="links_name">Apps</span>
                    </a>
                </li>

                {/* Agents Section - Hidden in collapsed */}
                {sidebarOpen && (
                    <>
                        {AGENTS.filter(a => a.id !== 'chat' && !a.hideInSidebar).map(agent => (
                            <li key={agent.id}>
                                <a
                                    href="#"
                                    onClick={e => { e.preventDefault(); setAppMode(agent.id); if(window.innerWidth <= 768) setSidebarOpen(false); }}
                                    className={appMode === agent.id ? 'active-agent' : ''}
                                    style={{ background: agent.color + '15', color: agent.color }}
                                    data-tooltip={agent.name}
                                >
                                    {agent.logo ? (
                                        <img
                                            src={agent.logo}
                                            alt={agent.name}
                                            style={{
                                                height: '20px',
                                                width: '20px',
                                                objectFit: 'contain'
                                            }}
                                        />
                                    ) : (
                                        <i className={`bx ${agent.icon}`} style={appMode === agent.id ? { color: agent.color } : {}} />
                                    )}
                                    <span className="links_name">
                                        {agent.name}
                                    </span>
                                </a>
                            </li>
                        ))}
                    </>
                )}
                <div className="sidebar-divider" />

                {/* History - Hidden in collapsed */}
                {sidebarOpen && (
                    <div className="history-container">
                        <ul id="chat-history-list">
                            {isGuest ? (
                                <li style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                    Sign in to save history
                                </li>
                            ) : (
                                <>
                                    {sessionsLoading && filteredSessions.length === 0 ? (
                                        <ConversationSkeleton />
                                    ) : (
                                        filteredSessions.map(s => (
                                            <li
                                                key={s._id}
                                                className={`history-item${(currentSessionId === s._id || sessionId === s._id) ? ' active' : ''}`}
                                                onClick={() => { setCurrentSessionId(s._id); if(window.innerWidth <= 768) setSidebarOpen(false); }}
                                                data-tooltip={s.title || "Untitled Chat"}
                                            >
                                                <i className='bx bx-message-square-detail' />
                                                <span className="history-item-title">
                                                    {s.title || "Untitled Chat"}
                                                </span>
                                                <i
                                                    className='bx bx-trash delete-chat-icon'
                                                    onClick={e => { e.stopPropagation(); setDeleteModal({ open: true, id: s._id }); }}
                                                />
                                            </li>
                                        ))
                                    )}

                                    {sessHasMore && (
                                        <li style={{ textAlign: 'center', padding: '8px 0' }}>
                                            {sessionsLoading ? (
                                                <div className="conv-load-more-spinner">
                                                    <span /><span /><span />
                                                </div>
                                            ) : (
                                                <a
                                                    href="#"
                                                    onClick={e => { e.preventDefault(); loadSessions(sessPage + 1, true); }}
                                                    style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}
                                                >
                                                    Load more
                                                </a>
                                            )}
                                        </li>
                                    )}
                                </>
                            )}
                        </ul>
                    </div>
                )}
            </ul>

            <div className="sidebar-footer">
                <div className="sidebar-footer-item">
                    <a href="#" id="settings-btn" data-tooltip="Settings" onClick={e => { e.preventDefault(); if(window.innerWidth <= 768) setSidebarOpen(false); setSettingsOpen(true); }}>
                        <i className='bx bx-cog' />
                        <span className="links_name">Settings</span>
                    </a>
                </div>

            
                {sidebarOpen && (
                    <div className="sidebar-legal-links">
                        <Link to="/privacy">Privacy</Link>
                        <span className="dot">·</span>
                        <Link to="/terms-of-service">Terms</Link>
                    </div>
                )}

                <div className="profile-section">
                    <div className="profile-details" id="profile-li" data-tooltip={user?.displayName || user?.email}>
                        <img id="_imgField" src={user?.photoURL || '/assets/Designer.png'} alt="Profile" />
                        <div className="name_job">
                            <div className="name">
                                <span id="loggedUserFName">{user?.displayName || (isGuest ? 'Guest' : user?.email?.split('@')[0])}</span>
                            </div>
                            <div className="job">
                                <span id="loggedUserEmail">{isGuest ? 'Guest Mode' : user?.email}</span>
                            </div>
                        </div>
                        <i className='bx bx-log-out' id="logout" data-tooltip="Logout" onClick={logout} />
                    </div>
                </div>
            </div>

           
            {sidebarOpen && <div className="sidebar-resizer" onMouseDown={startResizing} />}
        </div>
    );
}
