/**
 * Tidal Auth Hook
 *
 * Manages Tidal SDK authentication state and token storage.
 * The Tidal SDK handles token refresh internally - this hook syncs
 * tokens to the backend for server-side API calls.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  init,
  initializeLogin,
  finalizeLogin,
  credentialsProvider,
} from '@tidal-music/auth';

// Tidal OAuth configuration
const TIDAL_CLIENT_ID = import.meta.env.VITE_TIDAL_CLIENT_ID;
const TIDAL_REDIRECT_URI = import.meta.env.VITE_TIDAL_REDIRECT_URI;

// Required scopes for AlgoJuke
const TIDAL_SCOPES = [
  'user.read',
  'collection.read',
  'playlists.read',
  'playlists.write',
  'recommendations.read',
  'search.read',
];

export interface TidalAuthState {
  isInitialized: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
}

export interface UseTidalAuthReturn extends TidalAuthState {
  initiateTidalLogin: () => Promise<void>;
  finalizeTidalLogin: (callbackUrl: string) => Promise<boolean>;
  checkConnection: () => Promise<boolean>;
  refreshAndSyncToken: () => Promise<boolean>;
}

/**
 * Hook for managing Tidal authentication
 */
export function useTidalAuth(): UseTidalAuthReturn {
  const { getToken } = useAuth();
  const [state, setState] = useState<TidalAuthState>({
    isInitialized: false,
    isConnecting: false,
    isConnected: false,
    error: null,
  });

  // Initialize Tidal SDK on mount
  useEffect(() => {
    if (!TIDAL_CLIENT_ID) {
      setState((prev) => ({
        ...prev,
        error: 'Missing VITE_TIDAL_CLIENT_ID environment variable',
      }));
      return;
    }

    async function initializeSdk() {
      try {
        await init({
          clientId: TIDAL_CLIENT_ID,
          credentialsStorageKey: 'algojuke-tidal-auth',
          scopes: TIDAL_SCOPES,
        });
        setState((prev) => ({ ...prev, isInitialized: true }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: `Failed to initialize Tidal SDK: ${error}`,
        }));
      }
    }

    initializeSdk();
  }, []);

  /**
   * Check if user has a Tidal connection by querying the backend
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const token = await getToken();
      const response = await fetch('/api/auth/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const connected = data.hasTidalConnection === true;
      setState((prev) => ({ ...prev, isConnected: connected }));
      return connected;
    } catch {
      return false;
    }
  }, [getToken]);

  /**
   * Start the Tidal OAuth login flow
   */
  const initiateTidalLogin = useCallback(async (): Promise<void> => {
    if (!state.isInitialized) {
      setState((prev) => ({
        ...prev,
        error: 'Tidal SDK not initialized',
      }));
      return;
    }

    if (!TIDAL_REDIRECT_URI) {
      setState((prev) => ({
        ...prev,
        error: 'Missing VITE_TIDAL_REDIRECT_URI environment variable',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const loginUrl = await initializeLogin({
        redirectUri: TIDAL_REDIRECT_URI,
      });

      // Redirect to Tidal OAuth
      window.location.href = loginUrl;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: `Failed to start Tidal login: ${error}`,
      }));
    }
  }, [state.isInitialized]);

  /**
   * Sync current SDK credentials to backend.
   * The SDK automatically refreshes tokens when getCredentials() is called.
   */
  const syncTokensToBackend = useCallback(
    async (credentials: { token?: string; expires?: number; grantedScopes?: string[] }): Promise<boolean> => {
      if (!credentials.token) {
        return false;
      }
      const clerkToken = await getToken();

      const expiresAt = credentials.expires
        ? credentials.expires
        : Date.now() + 3600000; // Default 1h if not provided

      const response = await fetch('/api/auth/tidal/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          accessToken: credentials.token,
          // SDK manages refresh internally - we store a placeholder
          // Frontend is responsible for refreshing via SDK and syncing
          refreshToken: `sdk-managed-${Date.now()}`,
          expiresAt,
          scopes: credentials.grantedScopes || TIDAL_SCOPES,
        }),
      });

      return response.ok;
    },
    [getToken]
  );

  /**
   * Refresh token via SDK and sync to backend.
   * Call this when backend reports token is expired.
   */
  const refreshAndSyncToken = useCallback(async (): Promise<boolean> => {
    if (!state.isInitialized) {
      return false;
    }

    try {
      // SDK automatically refreshes token if expired
      const credentials = await credentialsProvider.getCredentials();

      if (!credentials || !credentials.token) {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          error: 'Tidal session expired. Please reconnect.',
        }));
        return false;
      }

      // Sync refreshed token to backend
      const success = await syncTokensToBackend(credentials);

      if (success) {
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
      }

      return success;
    } catch {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error: 'Failed to refresh Tidal token. Please reconnect.',
      }));
      return false;
    }
  }, [state.isInitialized, syncTokensToBackend]);

  /**
   * Complete the Tidal OAuth flow after redirect
   */
  const finalizeTidalLogin = useCallback(
    async (callbackUrl: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isConnecting: true, error: null }));

      try {
        // Finalize OAuth with Tidal SDK
        await finalizeLogin(callbackUrl);

        // Get credentials from SDK
        const credentials = await credentialsProvider.getCredentials();

        if (!credentials || !credentials.token) {
          throw new Error('Failed to get credentials from Tidal SDK');
        }

        // Sync tokens to backend
        const success = await syncTokensToBackend(credentials);

        if (!success) {
          throw new Error('Failed to store tokens on server');
        }

        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
          error: null,
        }));

        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: `Failed to complete Tidal login: ${error}`,
        }));
        return false;
      }
    },
    [syncTokensToBackend]
  );

  return {
    ...state,
    initiateTidalLogin,
    finalizeTidalLogin,
    checkConnection,
    refreshAndSyncToken,
  };
}
