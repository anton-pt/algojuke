/**
 * Component tests for ProtectedRoute
 *
 * Tests the route guard component for various authentication states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../../src/components/auth/ProtectedRoute';

// Mock Clerk hooks
const mockUseUser = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
}));

// Mock useTidalAuth hook
const mockUseTidalAuth = vi.fn();
vi.mock('../../../src/hooks/useTidalAuth', () => ({
  useTidalAuth: () => mockUseTidalAuth(),
}));

// Mock fetch for auth status
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ getToken: () => Promise.resolve('test-token') });
    mockUseTidalAuth.mockReturnValue({
      refreshAndSyncToken: vi.fn(),
      isInitialized: true,
    });
  });

  const renderWithRouter = (
    initialPath: string,
    requireTidal = false
  ) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div data-testid="landing">Landing</div>} />
          <Route path="/waitlist" element={<div data-testid="waitlist">Waitlist</div>} />
          <Route path="/connect-tidal" element={<div data-testid="connect">Connect Tidal</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute requireTidal={requireTidal}>
                <div data-testid="protected-content">Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('when not signed in', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false });
    });

    it('redirects to landing page', async () => {
      renderWithRouter('/protected');

      await waitFor(() => {
        expect(screen.getByTestId('landing')).toBeInTheDocument();
      });
    });
  });

  describe('when signed in but not approved', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          isAuthenticated: true,
          isApproved: false,
          hasTidalConnection: false,
        }),
      });
    });

    it('redirects to waitlist page', async () => {
      renderWithRouter('/protected');

      await waitFor(() => {
        expect(screen.getByTestId('waitlist')).toBeInTheDocument();
      });
    });
  });

  describe('when approved but no Tidal connection', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          isAuthenticated: true,
          isApproved: true,
          hasTidalConnection: false,
        }),
      });
    });

    it('redirects to connect page when requireTidal is true', async () => {
      renderWithRouter('/protected', true);

      await waitFor(() => {
        expect(screen.getByTestId('connect')).toBeInTheDocument();
      });
    });

    it('renders content when requireTidal is false', async () => {
      renderWithRouter('/protected', false);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });

  describe('when fully authenticated with Tidal', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          isAuthenticated: true,
          isApproved: true,
          hasTidalConnection: true,
          tidalTokenExpired: false,
        }),
      });
    });

    it('renders protected content', async () => {
      renderWithRouter('/protected', true);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });

  describe('when loading', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: false, isSignedIn: false });
    });

    it('shows loading state', () => {
      renderWithRouter('/protected');

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('when Tidal token is expired', () => {
    beforeEach(() => {
      mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
    });

    it('attempts to refresh token via SDK', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(true);
      mockUseTidalAuth.mockReturnValue({
        refreshAndSyncToken: mockRefresh,
        isInitialized: true,
      });

      // First call returns expired, second call returns refreshed
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              isAuthenticated: true,
              isApproved: true,
              hasTidalConnection: true,
              tidalTokenExpired: true,
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            isAuthenticated: true,
            isApproved: true,
            hasTidalConnection: true,
            tidalTokenExpired: false,
          }),
        });
      });

      renderWithRouter('/protected', true);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('redirects to connect page when refresh fails', async () => {
      const mockRefresh = vi.fn().mockResolvedValue(false);
      mockUseTidalAuth.mockReturnValue({
        refreshAndSyncToken: mockRefresh,
        isInitialized: true,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          isAuthenticated: true,
          isApproved: true,
          hasTidalConnection: true,
          tidalTokenExpired: true,
        }),
      });

      renderWithRouter('/protected', true);

      await waitFor(() => {
        expect(screen.getByTestId('connect')).toBeInTheDocument();
      });
    });
  });
});
