import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
    const navigate = useNavigate();

    return (
        <div className="legal-page-container">
            <header className="legal-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <i className='bx bx-left-arrow-alt'></i> Back
                </button>
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
