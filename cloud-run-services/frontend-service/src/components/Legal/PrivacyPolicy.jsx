import React from "react";


const PrivacyPolicy = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-logo-container">
          <img src="/treevit-favicon-circle-32px.png" alt="Treevit Logo" className="legal-logo" />
          <span className="legal-logo-text">Treevit</span>
        </div>
        <h1 className="legal-title">Privacy Policy</h1>

        <div className="legal-meta">
          <span>Effective: January 12, 2026</span>
          <span className="meta-divider"></span>
          <span>Version 1.2</span>
        </div>

        <hr className="legal-divider" />

        <div className="legal-content">
          <p>
            Treevit collects account details and usage data to operate, secure, and improve the service.
          </p>

          <h2>1. Data We Collect</h2>
          <p>
            We may collect account information, prompt/response content, and diagnostics required for product reliability.
          </p>

          <h2>2. How We Use Data</h2>
          <p>
            Data is used to provide core features, support users, improve service quality, and protect platform security.
          </p>

          <h2>3. Third-Party Processing</h2>
          <p>
            Some AI processing may involve trusted third-party model providers under contractual safeguards.
          </p>

          <h2>4. Your Rights</h2>
          <p>
            You may request access, correction, or deletion of personal data where applicable by law.
          </p>

          <h2>5. Contact</h2>
          <p>
            For privacy questions, contact <strong>privacy@treevit.ai</strong>.
          </p>
        </div>

        <div className="legal-footer">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
