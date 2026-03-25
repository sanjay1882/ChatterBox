import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TreevitWhite from '../../assets/Treevit_White_PNG.png';
import TreevitDark from '../../assets/treevit-personal-dark-512.png';

export default function PrivacyPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState(() => localStorage.getItem('app-theme-mode') || 'dark');

    useEffect(() => {
        if (mode === 'light') {
            document.body.setAttribute('data-theme', 'light');
        } else {
            document.body.removeAttribute('data-theme');
        }
    }, [mode]);

    return (
        <div className="legal-page-wrapper">
            <div className="legal-page-container">
                <header className="legal-header">
                    <div className="sticky-nav">
                        <button className="back-btn" onClick={() => navigate(-1)}>
                            <i className='bx bx-left-arrow-alt'></i> Back
                        </button>
                    </div>
                    <div className="legal-logo-container">
                        <img 
                            src={mode === 'light' ? TreevitWhite : TreevitDark} 
                            alt="Treevit Logo" 
                            className="legal-logo" 
                        />
                        <span className="legal-logo-text">Treevit</span>
                    </div>
                    <h1>Privacy Policy</h1>
                </header>
                <main className="legal-content">
                    <section>
                        <h2>1. Introduction</h2>
                        <p>Welcome to Treevit. Your privacy is important to us. We collect minimal data necessary to provide you with the best AI-powered chat experience.</p>
                    </section>
                    <section>
                        <h2>2. Information We Collect</h2>
                        <p>We collect your email address for account authentication and your chat history so you can pick up where you left off. We do not sell your data to third parties.</p>
                    </section>
                    <section>
                        <h2>3. How We Use Information</h2>
                        <p>Your session history is used to maintain your chat context. We may use anonymized usage data to improve our AI models and application performance.</p>
                    </section>
                    <section>
                        <h2>4. Data Security</h2>
                        <p>We use industry-standard encryption to protect your data during transit and at rest. However, no method of transmission over the internet is 100% secure.</p>
                    </section>
                    <section>
                        <h2>5. Contact Us</h2>
                        <p>If you have any questions about this Privacy Policy, please contact us at support@treevit.ai</p>
                    </section>
                </main>
            </div>
            <style>{`
                .legal-page-wrapper {
                    height: 100vh;
                    width: 100vw;
                    overflow-y: auto;
                    background: var(--bg-base);
                    color: var(--text-primary);
                    font-family: var(--font, 'Inter', sans-serif);
                }
                .legal-page-container {
                    max-width: 850px;
                    margin: 0 auto;
                    padding: 60px 40px;
                    animation: fadeIn 0.6s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .legal-header {
                    margin-bottom: 50px;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 30px;
                }
                .sticky-nav {
                    position: sticky;
                    top: 0;
                    background: var(--bg-base);
                    padding: 20px 0;
                    z-index: 100;
                }
                .legal-logo-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 25px;
                }
                .legal-logo {
                    width: 42px;
                    height: 42px;
                    object-fit: contain;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
                }
                .legal-logo-text {
                    font-size: 24px;
                    font-weight: 700;
                    color: var(--text-primary);
                    letter-spacing: -0.03em;
                    font-family: 'Outfit', sans-serif;
                }
                .back-btn {
                    background: var(--bg-elevated);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                }
                .back-btn:hover {
                    background: var(--bg-primary);
                    border-color: var(--accent);
                    transform: translateX(-4px);
                }
                .legal-header h1 {
                    font-size: 42px;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    color: var(--accent);
                    margin-top: 10px;
                }
                .legal-content h2 {
                    font-size: 22px;
                    font-weight: 700;
                    margin: 40px 0 15px;
                    color: var(--text-primary);
                    letter-spacing: -0.01em;
                }
                .legal-content p {
                    line-height: 1.7;
                    font-size: 16px;
                    color: var(--text-secondary);
                    margin-bottom: 20px;
                }
                section {
                    margin-bottom: 40px;
                }
                @media (max-width: 768px) {
                    .legal-page-container { padding: 40px 20px; }
                    .legal-header h1 { font-size: 32px; }
                }
            `}</style>
        </div>
    );
}
