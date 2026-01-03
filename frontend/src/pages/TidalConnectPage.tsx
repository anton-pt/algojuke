/**
 * Tidal Connect Page
 *
 * Prompts approved users to connect their Tidal account.
 */

import { UserButton } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { TidalConnectButton } from '../components/auth/TidalConnectButton';
import { useTidalAuth } from '../hooks/useTidalAuth';

interface LocationState {
  returnTo?: string;
}

// Storage key for preserving return URL across OAuth redirect
export const RETURN_URL_KEY = 'algojuke-return-url';

export function TidalConnectPage(): JSX.Element {
  const { error, isConnecting } = useTidalAuth();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const returnTo = state?.returnTo || '/discover';

  // Store return URL when initiating OAuth (will be read by CallbackPage)
  const handleConnect = () => {
    sessionStorage.setItem(RETURN_URL_KEY, returnTo);
  };

  return (
    <AuthLayout>
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
        <UserButton afterSignOutUrl="/" />
      </div>
      <h2>Connect Your Tidal Account</h2>
      <p>
        To use AlgoJuke, you need to connect your Tidal account. This allows us
        to access your music library and create personalized recommendations.
      </p>

      <ul className="auth-features">
        <li>Access your saved albums and playlists</li>
        <li>Get AI-powered music recommendations</li>
        <li>Discover new music based on your taste</li>
        <li>Create smart playlists automatically</li>
      </ul>

      {error && (
        <div className="auth-error">
          <p>{error}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      )}

      <TidalConnectButton disabled={isConnecting} onBeforeConnect={handleConnect} />

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
        We only request the permissions needed to provide our service. Your
        credentials are never stored on our servers.
      </p>
    </AuthLayout>
  );
}
