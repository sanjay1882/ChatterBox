import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CreditsProvider } from './contexts/CreditsContext';
import LoginPage from './components/Auth/LoginPage';
import ChatApp from './components/Chat/ChatApp';
import UpgradeModal from './components/Upgrade/UpgradeModal';

function InnerApp() {
  const { user, loading } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const shareId = params.get('share');

  // Handle successful upgrade redirect
  const upgradeStatus = params.get('upgrade');
  if (upgradeStatus === 'success') {
    // Clean URL without reload
    window.history.replaceState({}, '', '/');
    // Show success toast (handled in ChatApp on mount)
  }

  // If viewing a shared session link, immediately render read-only ChatApp
  if (shareId) {
    return <ChatApp sharedSessionId={shareId} />;
  }

  if (loading) {
    return (
      <div id="preloader">
        <div className="container">
          <h1 style={{ color: 'white' }}>Treevit</h1>
          <br />
          <p>Spinning up brilliance, just a sec...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <>
      <ChatApp upgradeSuccess={upgradeStatus === 'success'} />
      <UpgradeModal />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CreditsProvider>
        <InnerApp />
      </CreditsProvider>
    </AuthProvider>
  );
}
