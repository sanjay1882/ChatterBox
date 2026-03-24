import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CreditsProvider } from './contexts/CreditsContext';
import LoginPage from './components/Auth/LoginPage';
import ChatApp from './components/Chat/ChatApp';
import UpgradeModal from './components/Upgrade/UpgradeModal';
import ErrorBoundary from './components/Common/ErrorBoundary';
import PrivacyPolicy from './components/Legal/PrivacyPolicy';
import TermsOfService from './components/Legal/TermsOfService';

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function InnerApp() {
  const { user, loading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const shareId = params.get('share');

  // Handle successful upgrade redirect
  const upgradeStatus = params.get('upgrade');
  if (upgradeStatus === 'success') {
    // Clean URL without reload
    window.history.replaceState({}, '', '/');
  }

  if (loading) {
    return (
      <div id="preloader">
        <style>{`
          #preloader {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          .preloader-inner { text-align: center; }
          .preloader-logo { margin-bottom: 20px; animation: pulse 2s infinite ease-in-out; }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
          }
          .preloader-name { color: white; font-size: 2.5rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
          .preloader-bar-wrap { width: 150px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin: 20px auto 0; overflow: hidden; }
          .preloader-bar-fill { height: 100%; background: #10b981; animation: loading 2s infinite ease-in-out; width: 30%; border-radius: 2px; }
          @keyframes loading {
            0% { transform: translateX(-150%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
        <div className="preloader-inner">
          <svg className="preloader-logo" width="80" height="80" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <rect x="96" y="130" width="8" height="28" rx="4" fill="#fff" opacity="0.9"/>
            <g className="tw">
              <circle cx="100" cy="54"  r="14" fill="#fff"/>
              <circle cx="82"  cy="80"  r="11" fill="#fff" opacity=".85"/>
              <circle cx="118" cy="80"  r="11" fill="#fff" opacity=".85"/>
              <circle cx="68"  cy="106" r="9"  fill="#fff" opacity=".65"/>
              <circle cx="100" cy="100" r="13" fill="#fff" opacity=".9"/>
              <circle cx="132" cy="106" r="9"  fill="#fff" opacity=".65"/>
              <circle cx="56"  cy="128" r="8"  fill="#fff" opacity=".55"/>
              <circle cx="144" cy="128" r="8"  fill="#fff" opacity=".55"/>
              <circle cx="85"  cy="122" r="10" fill="#fff" opacity=".7"/>
              <circle cx="115" cy="122" r="10" fill="#fff" opacity=".7"/>
            </g>
          </svg>
          <h1 className="preloader-name">Treevit</h1>
          <div className="preloader-bar-wrap">
            <div className="preloader-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />
      
      {/* Public Share Route */}
      <Route path="/shared/:shareId" element={<ChatApp />} />

      {/* Protected Application Routes */}
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/chat/:sessionId?" element={<ProtectedRoute user={user}><ChatApp upgradeSuccess={upgradeStatus === 'success'} /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/apps" element={<Navigate to="/apps/excel" replace />} />
      <Route path="/apps/:agentId/:sessionId?" element={<ProtectedRoute user={user}><ChatApp initialAppsOpen={true} /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute user={user}><ChatApp initialSettingsOpen={true} /><UpgradeModal /></ProtectedRoute>} />
      
      {/* Legal Routes in Container */}
      <Route path="/privacy" element={<ProtectedRoute user={user}><ChatApp initialLegalOpen="privacy" /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/privacy-policy" element={<ProtectedRoute user={user}><ChatApp initialLegalOpen="privacy" /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/terms" element={<ProtectedRoute user={user}><ChatApp initialLegalOpen="terms" /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/terms-of-service" element={<ProtectedRoute user={user}><ChatApp initialLegalOpen="terms" /><UpgradeModal /></ProtectedRoute>} />
      <Route path="/terms-of-use" element={<ProtectedRoute user={user}><ChatApp initialLegalOpen="terms" /><UpgradeModal /></ProtectedRoute>} />
      
      {/* Redirect everything else to home or login */}
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <CreditsProvider>
            <InnerApp />
          </CreditsProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
