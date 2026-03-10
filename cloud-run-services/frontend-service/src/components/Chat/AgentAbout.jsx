// ── src/components/Apps/AgentAbout.jsx ───────────────────────────────────────
// Renders the "About this App" panel for ANY agent defined in agents.js.
// Used inside the Apps modal in ChatApp.jsx — no more per-agent if/else chains.
// ─────────────────────────────────────────────────────────────────────────────

const AgentAbout = ({ agent, onLaunch }) => {
    if (!agent) return null;

    const { name, icon, color, badge, description, about = {} } = agent;
    const { summary = description, features = [] } = about;

    const accentColor  = color || 'var(--accent)';
    const accentBg     = `${accentColor}15`;
    const accentBorder = `${accentColor}30`;

    return (
        <div style={{
            display:       'flex',
            flexDirection: 'column',
            height:        '100%',
            maxWidth:      '800px',
            margin:        '0 auto',
            padding:       '20px 40px',
            overflowY:     'auto',
        }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '32px' }}>
                {/* Icon */}
                <div style={{
                    width: '100px', height: '100px', borderRadius: '24px',
                    background: accentBg, border: `1px solid ${accentBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <i className={`bx ${icon}`} style={{ fontSize: '56px', color: accentColor }} />
                </div>

                {/* Title + description + launch */}
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <h2 style={{ fontSize: '28px', color: 'var(--sarvam-text-main)', margin: 0, fontWeight: 700 }}>
                            {name}
                        </h2>
                        {badge && (
                            <span style={{
                                background: accentColor, color: '#fff',
                                fontSize: '11px', padding: '4px 8px',
                                borderRadius: '12px', fontWeight: 600, letterSpacing: '0.5px',
                            }}>
                                {badge}
                            </span>
                        )}
                    </div>

                    <p style={{
                        color: 'var(--sarvam-text-secondary)', fontSize: '15px',
                        margin: '0 0 20px 0', lineHeight: 1.6,
                    }}>
                        {description}
                    </p>

                    <button
                        onClick={onLaunch}
                        className="save-btn"
                        style={{ padding: '12px 28px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        <i className='bx bx-play-circle' style={{ fontSize: '20px' }} />
                        Launch App
                    </button>
                </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--sarvam-border)', margin: '0 0 32px 0' }} />

            {/* ── About summary ── */}
            <h3 style={{ color: 'var(--sarvam-text-main)', fontSize: '17px', marginBottom: '14px', fontWeight: 600 }}>
                About this App
            </h3>

            <div style={{
                background: 'var(--sarvam-bg-elevated)', border: '1px solid var(--sarvam-border)',
                borderRadius: '16px', padding: '24px', marginBottom: '28px',
                color: 'var(--sarvam-text-secondary)', fontSize: '15px', lineHeight: 1.75,
                whiteSpace: 'pre-line',
            }}>
                {summary}
            </div>

            {/* ── Feature grid ── */}
            {features.length > 0 && (
                <>
                    <h3 style={{ color: 'var(--sarvam-text-main)', fontSize: '17px', marginBottom: '16px', fontWeight: 600 }}>
                        What it can do
                    </h3>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: '14px',
                    }}>
                        {features.map((f, i) => (
                            <div key={i} style={{
                                background:   'var(--sarvam-bg-elevated)',
                                border:       '1px solid var(--sarvam-border)',
                                borderRadius: '14px',
                                padding:      '18px 16px',
                                display:      'flex',
                                flexDirection:'column',
                                gap:          '8px',
                                transition:   'border-color 0.2s',
                            }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = accentColor}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--sarvam-border)'}
                            >
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: accentBg, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <i className={`bx ${f.icon}`} style={{ fontSize: '18px', color: accentColor }} />
                                </div>
                                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--sarvam-text-main)' }}>
                                    {f.title}
                                </div>
                                <div style={{ fontSize: '12.5px', color: 'var(--sarvam-text-secondary)', lineHeight: 1.55 }}>
                                    {f.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default AgentAbout;