/**
 * OAuth Callback Page
 *
 * Handles the redirect from Tidal OAuth and finalizes the connection.
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { useTidalAuth } from '../hooks/useTidalAuth';
import { RETURN_URL_KEY } from './TidalConnectPage';

type CallbackState = 'processing' | 'success' | 'error' | 'cancelled';

export function CallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { finalizeTidalLogin, error, isInitialized } = useTidalAuth();
  const [state, setState] = useState<CallbackState>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Wait for Tidal SDK to initialize before processing callback
    if (!isInitialized) {
      return;
    }

    // Prevent multiple processing attempts
    if (hasProcessed.current) {
      return;
    }
    hasProcessed.current = true;

    async function handleCallback() {
      // Get just the query string (the SDK parses this with URLSearchParams)
      const callbackUrl = window.location.search;

      // Check for OAuth error in URL params
      const params = new URLSearchParams(location.search);
      if (params.has('error')) {
        const errorCode = params.get('error');
        const errorDesc = params.get('error_description');

        // Handle user cancellation specifically
        if (errorCode === 'access_denied') {
          setState('cancelled');
          return;
        }

        // Other OAuth errors
        setErrorMessage(errorDesc || errorCode || 'Unknown error');
        setState('error');
        return;
      }

      // Check for authorization code
      if (!params.has('code')) {
        setErrorMessage('No authorization code received');
        setState('error');
        return;
      }

      try {
        const success = await finalizeTidalLogin(callbackUrl);

        if (success) {
          setState('success');
          // Get return URL from session storage (set before OAuth redirect)
          const returnUrl = sessionStorage.getItem(RETURN_URL_KEY) || '/discover';
          sessionStorage.removeItem(RETURN_URL_KEY);

          // Redirect to original destination after short delay
          setTimeout(() => {
            navigate(returnUrl, { replace: true });
          }, 1500);
        } else {
          setState('error');
          setErrorMessage(error || 'Failed to complete Tidal connection');
        }
      } catch (err) {
        setState('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred');
      }
    }

    handleCallback();
  }, [finalizeTidalLogin, navigate, location.search, error, isInitialized]);

  const handleRetry = () => {
    // Preserve return URL for retry
    navigate('/connect-tidal', { replace: true });
  };

  return (
    <AuthLayout>
      {state === 'processing' && (
        <div style={{ textAlign: 'center' }}>
          <div className="auth-loading">
            <div className="spinner" />
            <h2>Connecting to Tidal...</h2>
            <p>Please wait while we complete your connection.</p>
          </div>
        </div>
      )}

      {state === 'success' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2>Connected!</h2>
          <p>Your Tidal account has been connected successfully.</p>
          <p style={{ opacity: 0.7 }}>Redirecting to AlgoJuke...</p>
        </div>
      )}

      {state === 'cancelled' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>←</div>
          <h2>Connection Cancelled</h2>
          <p>
            You cancelled the Tidal authorization. No worries – you can try again
            whenever you're ready.
          </p>
          <p style={{ marginTop: '1rem', opacity: 0.7 }}>
            AlgoJuke needs access to your Tidal account to provide personalized
            music recommendations.
          </p>
          <button className="auth-button" onClick={handleRetry} style={{ marginTop: '1.5rem' }}>
            Try Again
          </button>
        </div>
      )}

      {state === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✗</div>
          <h2>Connection Failed</h2>
          {errorMessage && (
            <div className="auth-error">
              <p>{errorMessage}</p>
            </div>
          )}
          <p>There was a problem connecting your Tidal account.</p>
          <button className="auth-button" onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}
    </AuthLayout>
  );
}
