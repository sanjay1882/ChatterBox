import React from "react";


const TermsOfService = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <div className="legal-logo-container">
          <img src="/treevit-favicon-circle-32px.png" alt="Treevit Logo" className="legal-logo" />
          <span className="legal-logo-text">Treevit</span>
        </div>
        <h1 className="legal-title">Terms of Service</h1>

        <div className="legal-meta">
          <span>Last Updated: March 14, 2026</span>
          <span className="meta-divider"></span>
          <span>Version 1.2</span>
        </div>

        <hr className="legal-divider" />

        <div className="legal-content">
          <p>
            Welcome to Treevit. These Terms of Service govern your access to and use of Treevit services.
          </p>

          <h2>1. Use of Services</h2>
          <p>
            You must use the service lawfully and keep your account credentials secure.
          </p>

          <h2>2. AI Content</h2>
          <p>
            AI output may be inaccurate or incomplete. Verify critical information independently.
          </p>

          <h2>3. Intellectual Property</h2>
          <p>
            Treevit and its licensors retain rights to service content, software, and branding.
          </p>

          <h2>4. Liability</h2>
          <p>
            To the fullest extent permitted by law, Treevit is not liable for indirect or consequential damages.
          </p>

          <h2>5. Changes</h2>
          <p>
            We may update these terms over time. Continued use means acceptance of revised terms.
          </p>
        </div>

        <div className="legal-footer">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
