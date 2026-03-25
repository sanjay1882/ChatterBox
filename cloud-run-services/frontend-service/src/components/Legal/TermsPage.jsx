import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import TreevitWhite from '../../assets/Treevit_White_PNG.png';
import TreevitDark from '../../assets/treevit-personal-dark-512.png';

export default function TermsPage() {
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
                    <h1>Terms of Service</h1>
                </header>
                <main className="legal-content">
                    <section>
                        <h2>1. Agreement to Terms</h2>
                        <p>By using the Treevit platform ("Platform"), you agree to follow these Terms of Service. If you don't agree, please stop using the Platform.</p>
                    </section>
                    <section>
                        <h2>2. Use of AI Service</h2>
                        <p>Treevit provides users with access to generative artificial intelligence (AI) models. While we strive to provide the most accurate and high-quality results, you acknowledge that AI-generated content can be incorrect, biased, or harmful.</p>
                    </section>
                    <section>
                        <h2>3. Prohibited Conduct</h2>
                        <p>You agree not to use Treevit to create, share, or store content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable.</p>
                    </section>
                    <section>
                        <h2>4. Intellectual Property</h2>
                        <p>Treevit's AI generated content is for your personal and commercial use unless stated otherwise. We do not claim ownership of the content you generate through our platform.</p>
                    </section>
                    <section>
                        <h2>5. Termination</h2>
                        <p>We reserve the right to terminate or suspend your access to our Platform at any time, for any reason, including without limitation if you breach the Terms.</p>
                    </section>
                    <section>
                        <h2>6. Contact Us</h2>
                        <p>If you have any questions about these Terms of Service, please contact us at support@treevit.ai</p>
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
