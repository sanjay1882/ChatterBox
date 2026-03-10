import React from 'react';
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
    user,
    logout,
    isGuest,
    appMode,
    setAppMode,
    searchQuery,
    setSearchQuery,
    startNewChat,
    filteredSessions,
    currentSessionId,
    setCurrentSessionId,
    setDeleteModal,
    sessHasMore,
    sessionsLoading,
    loadSessions,
    sessPage,
    setSettingsOpen,
    setAppsOpen,
    galleryCount = 0,
    onOpenGallery,
}) {
    return (
        <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
            <div className="logo-details">
                <i className='bx bx-doughnut-chart' />
                <i className='bx bx-menu-alt-right' id="btn" onClick={() => setSidebarOpen(false)} />
            </div>

            <ul className="nav-list">
                {/* Search */}
                <li>
                    <i className='bx bx-search' />
                    <input
                        type="text"
                        placeholder="Search..."
                        id="sidebar-search-input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </li>

                {/* New Chat */}
                <li className="Newchat-Btn">
                    <a href="#" onClick={e => { e.preventDefault(); startNewChat(); }}>
                        <i className='bx bx-chat' />
                        <span className="links_name">New Chat</span>
                    </a>
                </li>

                {/* Gallery — now functional */}
                <li>
                    <a
                        href="#"
                        id="gallery-btn"
                        onClick={e => { e.preventDefault(); onOpenGallery?.(); setSidebarOpen(false); }}
                        title="View generated images"
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

                {/* Apps trigger (opens modal) */}
                <li>
                    <a href="#" id="apps-btn" onClick={e => {
                        e.preventDefault();
                        setAppsOpen(true);
                        setSidebarOpen(false);
                    }}>
                        <i className='bx bx-grid-alt' />
                        <span className="links_name">Apps</span>
                    </a>
                </li>

                {/* Dynamic Agents Registry */}
                <div className="sidebar-divider" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '10px 15px' }} />

                {AGENTS.filter(a => a.id !== 'chat' && !a.hideInSidebar).map(agent => (
                    <li key={agent.id}>
                        <a
                            href="#"
                            onClick={e => { e.preventDefault(); setAppMode(agent.id); setSidebarOpen(false); }}
                            className={appMode === agent.id ? 'active-agent' : ''}
                            style={appMode === agent.id ? { background: agent.color + '15', color: agent.color } : {}}
                        >
                            <i className={`bx ${agent.icon}`} style={appMode === agent.id ? { color: agent.color } : {}} />
                            <span className="links_name">
                                {agent.name}
                                {agent.badge && <span className="agent-badge">{agent.badge}</span>}
                            </span>
                        </a>
                    </li>
                ))}

                {/* History */}
                <div className="history-container">
                    <ul id="chat-history-list">
                        {isGuest ? (
                            <li style={{ padding: '10px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                                Sign in to save history
                            </li>
                        ) : (
                            <>
                                {/* Initial load skeleton */}
                                {sessionsLoading && filteredSessions.length === 0 ? (
                                    <ConversationSkeleton />
                                ) : (
                                    filteredSessions.map(s => (
                                        <li
                                            key={s._id}
                                            className={`history-item${currentSessionId === s._id ? ' active' : ''}`}
                                            onClick={() => { setCurrentSessionId(s._id); setSidebarOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', margin: '2px 0' }}
                                        >
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                                                {s.title}
                                            </span>
                                            <i
                                                className='bx bx-trash'
                                                style={{ fontSize: 14, opacity: 0.5, marginLeft: 6, flexShrink: 0 }}
                                                onClick={e => { e.stopPropagation(); setDeleteModal({ open: true, id: s._id }); }}
                                            />
                                        </li>
                                    ))
                                )}

                                {/* Load more */}
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

                {/* Settings */}
                <li id="settings-li">
                    <a href="#" id="settings-btn" title="Settings" onClick={e => { e.preventDefault(); setSettingsOpen(true); }}>
                        <i className='bx bx-cog' />
                        <span className="links_name">Settings</span>
                    </a>
                </li>

                {/* Profile */}
                <li className="profile" id="profile-li">
                    <div className="profile-details">
                        <img id="_imgField" src={user?.photoURL || '/assets/Designer.png'} alt="Profile" />
                        <div className="name_job">
                            <div className="name">
                                <span id="loggedUserFName">{user?.displayName || (isGuest ? 'Guest' : user?.email?.split('@')[0])}</span>
                            </div>
                            <div className="job">
                                <span id="loggedUserEmail">{isGuest ? 'Guest Mode' : user?.email}</span>
                            </div>
                        </div>
                        <i className='bx bx-log-out' id="logout" title="Logout" onClick={logout} />
                    </div>
                </li>
            </ul>
        </div>
    );
}
