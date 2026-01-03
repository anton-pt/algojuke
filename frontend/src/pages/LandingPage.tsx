/**
 * Landing Page
 *
 * Public landing page explaining AlgoJuke service with sign-in option.
 */

import { SignInButton, useUser } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthLayout } from '../components/layout/AuthLayout';

interface LocationState {
  from?: { pathname: string };
}

export function LandingPage(): JSX.Element {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the original URL the user was trying to access (if any)
  const state = location.state as LocationState | null;
  const returnTo = state?.from?.pathname || '/discover';

  // Redirect signed-in users to appropriate page
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // Let ProtectedRoute handle the routing based on approval/Tidal status
      navigate(returnTo, { replace: true });
    }
  }, [isLoaded, isSignedIn, navigate, returnTo]);

  return (
    <AuthLayout>
      <h2>AI-Powered Music Discovery</h2>
      <p>
        AlgoJuke uses artificial intelligence to help you discover new music
        based on your Tidal library. Get personalized recommendations, create
        smart playlists, and explore music in a whole new way.
      </p>

      <ul className="auth-features">
        <li>Semantic search across your library</li>
        <li>AI-powered music recommendations</li>
        <li>Smart playlist generation</li>
        <li>Deep music analysis and insights</li>
      </ul>

      <SignInButton mode="modal">
        <button className="auth-button">
          <GoogleIcon />
          Sign in with Google
        </button>
      </SignInButton>

      <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
        AlgoJuke is currently in private beta. Sign in to check if you have access.
      </p>
    </AuthLayout>
  );
}

/**
 * Google logo icon
 */
function GoogleIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
