/**
 * Protected Route Component
 *
 * Guards routes based on authentication and authorization state.
 * Redirects users to appropriate pages based on their access level.
 */

import { ReactNode, useEffect, useState, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useTidalAuth } from '../../hooks/useTidalAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * If true, requires the user to have connected their Tidal account
   */
  requireTidal?: boolean;
}

interface AuthStatus {
  isAuthenticated: boolean;
  isApproved: boolean;
  hasTidalConnection: boolean;
  tidalTokenExpired?: boolean;
}

/**
 * Route guard that checks authentication, approval status, and Tidal connection.
 *
 * Redirect logic:
 * - Not signed in → Landing page (/)
 * - Signed in but not approved → Waitlist page (/waitlist)
 * - Approved but no Tidal connection (when requireTidal=true) → Connect page (/connect-tidal)
 * - Token expired → Attempt refresh via SDK
 * - Otherwise → Render children
 */
export function ProtectedRoute({
  children,
  requireTidal = false,
}: ProtectedRouteProps): ReactNode {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const location = useLocation();
  const { refreshAndSyncToken, isInitialized: tidalSdkReady } = useTidalAuth();

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch('/api/auth/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const status: AuthStatus = await response.json();
        setAuthStatus(status);

        // If token is expired and we have Tidal SDK ready, try to refresh
        if (status.tidalTokenExpired && tidalSdkReady && !isRefreshing && !refreshFailed) {
          setIsRefreshing(true);
          const refreshSuccess = await refreshAndSyncToken();
          setIsRefreshing(false);

          if (refreshSuccess) {
            // Re-check auth status after successful refresh
            const refreshedResponse = await fetch('/api/auth/status', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (refreshedResponse.ok) {
              setAuthStatus(await refreshedResponse.json());
            }
          } else {
            setRefreshFailed(true);
          }
        }
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken, tidalSdkReady, isRefreshing, refreshFailed, refreshAndSyncToken]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Show loading state while checking auth
  if (!isLoaded || isLoading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  // Not signed in → Landing page
  if (!isSignedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Still fetching auth status
  if (!authStatus) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Checking authorization...</p>
      </div>
    );
  }

  // Refreshing token
  if (isRefreshing) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Refreshing Tidal connection...</p>
      </div>
    );
  }

  // Token refresh failed - need to reconnect
  if (refreshFailed) {
    return <Navigate to="/connect-tidal" state={{ returnTo: location.pathname }} replace />;
  }

  // Signed in but not approved → Waitlist
  if (!authStatus.isApproved) {
    return <Navigate to="/waitlist" state={{ from: location }} replace />;
  }

  // Approved but no Tidal connection (when required) → Connect page
  // Pass through the original destination URL
  if (requireTidal && !authStatus.hasTidalConnection) {
    return <Navigate to="/connect-tidal" state={{ returnTo: location.pathname }} replace />;
  }

  // All checks passed → Render children
  return <>{children}</>;
}
