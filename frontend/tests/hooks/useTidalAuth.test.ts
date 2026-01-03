/**
 * Hook tests for useTidalAuth
 *
 * Tests the Tidal authentication hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Clerk useAuth
const mockGetToken = vi.fn().mockResolvedValue('clerk-token');
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}));

// Mock Tidal SDK
const mockInit = vi.fn().mockResolvedValue(undefined);
const mockInitializeLogin = vi.fn().mockResolvedValue('https://tidal.com/oauth/authorize');
const mockFinalizeLogin = vi.fn().mockResolvedValue(undefined);
const mockGetCredentials = vi.fn();
vi.mock('@tidal-music/auth', () => ({
  init: (...args: unknown[]) => mockInit(...args),
  initializeLogin: (...args: unknown[]) => mockInitializeLogin(...args),
  finalizeLogin: (...args: unknown[]) => mockFinalizeLogin(...args),
  credentialsProvider: {
    getCredentials: () => mockGetCredentials(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});
afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

// Import hook after mocks are set up
import { useTidalAuth } from '../../src/hooks/useTidalAuth';

describe('useTidalAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  describe('initialization', () => {
    it('initializes SDK on mount', async () => {
      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      // Verify SDK was initialized with correct structure
      // (env vars from .env.example or runtime environment)
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          credentialsStorageKey: 'algojuke-tidal-auth',
          scopes: expect.arrayContaining(['user.read', 'collection.read']),
        })
      );
    });

    // Note: Testing missing client ID requires build-time env var handling
    // which is not practical in unit tests. The behavior is verified manually.
  });

  describe('initiateTidalLogin', () => {
    it('redirects to Tidal OAuth URL', async () => {
      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.initiateTidalLogin();
      });

      expect(mockInitializeLogin).toHaveBeenCalled();
      expect(window.location.href).toBe('https://tidal.com/oauth/authorize');
    });

    it('sets isConnecting during login', async () => {
      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      // Start login (don't await to check intermediate state)
      act(() => {
        result.current.initiateTidalLogin();
      });

      expect(result.current.isConnecting).toBe(true);
    });

    it('sets error when not initialized', async () => {
      mockInit.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useTidalAuth());

      await act(async () => {
        await result.current.initiateTidalLogin();
      });

      expect(result.current.error).toContain('not initialized');
    });
  });

  describe('finalizeTidalLogin', () => {
    beforeEach(() => {
      mockGetCredentials.mockResolvedValue({
        token: 'tidal-access-token',
        expires: Date.now() + 3600000,
        grantedScopes: ['user.read', 'collection.read'],
      });
    });

    it('exchanges code for tokens and stores them', async () => {
      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.finalizeTidalLogin('?code=auth-code');
      });

      expect(success).toBe(true);
      expect(mockFinalizeLogin).toHaveBeenCalledWith('?code=auth-code');
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/tidal/tokens', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer clerk-token',
        }),
      }));
    });

    it('sets isConnected on success', async () => {
      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      await act(async () => {
        await result.current.finalizeTidalLogin('?code=auth-code');
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('sets error when credentials are missing', async () => {
      mockGetCredentials.mockResolvedValue(null);

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.finalizeTidalLogin('?code=auth-code');
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('Failed to get credentials');
    });

    it('sets error when backend storage fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Storage failed' }),
      });

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.finalizeTidalLogin('?code=auth-code');
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('Failed to complete');
    });
  });

  describe('refreshAndSyncToken', () => {
    it('refreshes token via SDK and syncs to backend', async () => {
      mockGetCredentials.mockResolvedValue({
        token: 'new-tidal-token',
        expires: Date.now() + 7200000,
        grantedScopes: ['user.read', 'collection.read'],
      });

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.refreshAndSyncToken();
      });

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/tidal/tokens', expect.objectContaining({
        method: 'POST',
      }));
    });

    it('returns false when SDK has no credentials', async () => {
      mockGetCredentials.mockResolvedValue(null);

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.refreshAndSyncToken();
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('expired');
    });
  });

  describe('checkConnection', () => {
    it('queries backend for connection status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasTidalConnection: true }),
      });

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let connected: boolean = false;
      await act(async () => {
        connected = await result.current.checkConnection();
      });

      expect(connected).toBe(true);
      expect(result.current.isConnected).toBe(true);
    });

    it('returns false when not connected', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hasTidalConnection: false }),
      });

      const { result } = renderHook(() => useTidalAuth());

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      let connected: boolean = true;
      await act(async () => {
        connected = await result.current.checkConnection();
      });

      expect(connected).toBe(false);
    });
  });
});
