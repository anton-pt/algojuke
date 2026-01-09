/**
 * Protected Route Component
 *
 * Guards routes based on authentication and authorization state.
 * Redirects users to appropriate pages based on their access level.
 */

import { ReactNode, useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useTidalAuth } from "../../hooks/useTidalAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  /**
   * If true, requires the user to have connected their Tidal account
   */
  requireTidal?: boolean;
}

interface AuthStatus {
  isAuthenticated: boolean;
  hasTidalConnection: boolean;
  tidalTokenExpired?: boolean;
}

/**
 * Route guard that checks authentication and Tidal connection.
 *
 * Redirect logic:
 * - Not signed in → Landing page (/)
 * - Signed in but no Tidal connection (when requireTidal=true) → Connect page (/connect-tidal)
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

  // Track if we've already checked auth status to prevent loops
  const hasCheckedAuth = useRef(false);
  // Track if we've already attempted a refresh to prevent loops
  const hasAttemptedRefresh = useRef(false);

  // Effect for initial auth check - runs once when user is loaded and signed in
  useEffect(() => {
    // Skip if already checked
    if (hasCheckedAuth.current) {
      return;
    }

    // Wait for Clerk to load
    if (!isLoaded) {
      return;
    }

    // Not signed in - just stop loading
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    // Mark as checked to prevent re-runs
    hasCheckedAuth.current = true;

    const fetchAuthStatus = async () => {
      try {
        const token = await getToken();
        const response = await fetch("/api/auth/status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const status: AuthStatus = await response.json();
          setAuthStatus(status);
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuthStatus();
  }, [isLoaded, isSignedIn, getToken]);

  // Separate effect for token refresh - only runs when we have auth status
  // and token is expired, and we haven't already tried refreshing
  useEffect(() => {
    if (
      authStatus?.tidalTokenExpired &&
      tidalSdkReady &&
      !isRefreshing &&
      !refreshFailed &&
      !hasAttemptedRefresh.current
    ) {
      hasAttemptedRefresh.current = true;
      setIsRefreshing(true);

      refreshAndSyncToken()
        .then(async (refreshSuccess) => {
          if (refreshSuccess) {
            // Re-check auth status after successful refresh
            const token = await getToken();
            const refreshedResponse = await fetch("/api/auth/status", {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (refreshedResponse.ok) {
              setAuthStatus(await refreshedResponse.json());
            }
          } else {
            setRefreshFailed(true);
          }
        })
        .catch(() => {
          setRefreshFailed(true);
        })
        .finally(() => {
          setIsRefreshing(false);
        });
    }
  }, [
    authStatus?.tidalTokenExpired,
    tidalSdkReady,
    isRefreshing,
    refreshFailed,
    refreshAndSyncToken,
    getToken,
  ]);

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
  // Don't redirect if we're already on /connect-tidal to avoid infinite loop
  if (refreshFailed && location.pathname !== "/connect-tidal") {
    return (
      <Navigate
        to="/connect-tidal"
        state={{ returnTo: location.pathname }}
        replace
      />
    );
  }

  // Signed in but no Tidal connection (when required) → Connect page
  // Pass through the original destination URL
  // Don't redirect if we're already on /connect-tidal to avoid infinite loop
  if (
    requireTidal &&
    !authStatus.hasTidalConnection &&
    location.pathname !== "/connect-tidal"
  ) {
    return (
      <Navigate
        to="/connect-tidal"
        state={{ returnTo: location.pathname }}
        replace
      />
    );
  }

  // All checks passed → Render children
  return <>{children}</>;
}
