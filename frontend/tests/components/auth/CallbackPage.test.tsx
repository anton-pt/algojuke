/**
 * Component tests for CallbackPage
 *
 * Tests the OAuth callback handling page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CallbackPage } from '../../../src/pages/CallbackPage';
import { RETURN_URL_KEY } from '../../../src/pages/TidalConnectPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useTidalAuth hook
const mockFinalizeTidalLogin = vi.fn();
vi.mock('../../../src/hooks/useTidalAuth', () => ({
  useTidalAuth: () => ({
    finalizeTidalLogin: mockFinalizeTidalLogin,
    error: null,
    isInitialized: true,
  }),
}));

// Mock sessionStorage
const sessionStorageData: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string) => sessionStorageData[key] || null,
  setItem: (key: string, value: string) => { sessionStorageData[key] = value; },
  removeItem: (key: string) => { delete sessionStorageData[key]; },
  clear: () => { Object.keys(sessionStorageData).forEach(key => delete sessionStorageData[key]); },
  length: 0,
  key: () => null,
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true });

// Store original location
const originalLocation = window.location;

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageData[RETURN_URL_KEY] = '/library';
  });

  afterEach(() => {
    mockSessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  const renderWithSearchParams = (search: string) => {
    // Mock window.location.search since component uses it directly
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, search },
      writable: true,
    });

    return render(
      <MemoryRouter initialEntries={[`/auth/tidal/callback${search}`]}>
        <Routes>
          <Route path="/auth/tidal/callback" element={<CallbackPage />} />
          <Route path="/connect-tidal" element={<div>Connect Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('when OAuth succeeds', () => {
    beforeEach(() => {
      mockFinalizeTidalLogin.mockResolvedValue(true);
    });

    it('shows success state after finalization', async () => {
      renderWithSearchParams('?code=test-auth-code');

      await waitFor(() => {
        expect(screen.getByText(/connected!/i)).toBeInTheDocument();
      });
    });

    it('redirects to stored return URL after success', async () => {
      vi.useFakeTimers();

      renderWithSearchParams('?code=test-auth-code');

      // Wait for success state (use real promise resolution)
      await vi.waitFor(() => {
        expect(screen.getByText(/connected!/i)).toBeInTheDocument();
      });

      // Advance timer for redirect
      await vi.advanceTimersByTimeAsync(1500);

      expect(mockNavigate).toHaveBeenCalledWith('/library', { replace: true });

      vi.useRealTimers();
    });

    it('redirects to /discover when no return URL stored', async () => {
      vi.useFakeTimers();
      delete sessionStorageData[RETURN_URL_KEY];

      renderWithSearchParams('?code=test-auth-code');

      await vi.waitFor(() => {
        expect(screen.getByText(/connected!/i)).toBeInTheDocument();
      });

      await vi.advanceTimersByTimeAsync(1500);

      expect(mockNavigate).toHaveBeenCalledWith('/discover', { replace: true });

      vi.useRealTimers();
    });
  });

  describe('when OAuth is cancelled', () => {
    it('shows cancelled state with user-friendly message', async () => {
      renderWithSearchParams('?error=access_denied');

      await waitFor(() => {
        expect(screen.getByText(/connection cancelled/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/you cancelled the tidal authorization/i)).toBeInTheDocument();
    });

    it('shows try again button', async () => {
      renderWithSearchParams('?error=access_denied');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  describe('when OAuth fails', () => {
    it('shows error state with error description', async () => {
      renderWithSearchParams('?error=server_error&error_description=Internal+server+error');

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    });

    it('shows error when no code is present', async () => {
      renderWithSearchParams('');

      await waitFor(() => {
        expect(screen.getByText(/no authorization code received/i)).toBeInTheDocument();
      });
    });

    it('shows error when finalization fails', async () => {
      mockFinalizeTidalLogin.mockResolvedValue(false);

      renderWithSearchParams('?code=test-auth-code');

      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });
    });
  });
});
