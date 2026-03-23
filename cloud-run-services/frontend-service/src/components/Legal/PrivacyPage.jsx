import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
    const navigate = useNavigate();

    return (
        <div className="legal-page-container">
            <header className="legal-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <i className='bx bx-left-arrow-alt'></i> Back
                </button>
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
            <style>{`
                .legal-page-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    color: var(--text-primary);
                    background: var(--bg-base);
                    min-height: 100vh;
                    font-family: var(--font);
                }
                .legal-header {
                    margin-bottom: 40px;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 20px;
                }
                .back-btn {
                    background: transparent;
                    color: var(--accent);
                    border: none;
                    font-size: 14px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 0;
                    margin-bottom: 20px;
                }
                .legal-header h1 {
                    font-size: 32px;
                    font-weight: 700;
                }
                .legal-content h2 {
                    font-size: 20px;
                    margin: 25px 0 15px;
                    color: var(--accent);
                }
                .legal-content p {
                    line-height: 1.6;
                    color: var(--text-secondary);
                    margin-bottom: 15px;
                }
                section {
                    margin-bottom: 30px;
                }
            `}</style>
        </div>
    );
}
