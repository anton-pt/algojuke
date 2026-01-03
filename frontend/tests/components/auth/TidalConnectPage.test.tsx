/**
 * Component tests for TidalConnectPage
 *
 * Tests the Tidal connection page for approved users.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TidalConnectPage, RETURN_URL_KEY } from '../../../src/pages/TidalConnectPage';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  UserButton: () => <button data-testid="user-button">User</button>,
}));

// Mock useTidalAuth hook
const mockInitiateTidalLogin = vi.fn();
const mockUseTidalAuth = vi.fn();
vi.mock('../../../src/hooks/useTidalAuth', () => ({
  useTidalAuth: () => mockUseTidalAuth(),
}));

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

describe('TidalConnectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTidalAuth.mockReturnValue({
      error: null,
      isConnecting: false,
      initiateTidalLogin: mockInitiateTidalLogin,
      isInitialized: true,
    });
  });

  const renderWithRouter = (state?: { returnTo?: string }) => {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/connect-tidal', state }]}>
        <TidalConnectPage />
      </MemoryRouter>
    );
  };

  it('renders the page heading', () => {
    renderWithRouter();
    expect(screen.getByRole('heading', { name: /connect your tidal account/i })).toBeInTheDocument();
  });

  it('displays user button for sign out', () => {
    renderWithRouter();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('lists features that require Tidal connection', () => {
    renderWithRouter();
    expect(screen.getByText(/access your saved albums/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-powered music recommendations/i)).toBeInTheDocument();
  });

  it('displays connect button', () => {
    renderWithRouter();
    expect(screen.getByText(/connect with tidal/i)).toBeInTheDocument();
  });

  it('stores return URL in sessionStorage when connecting', () => {
    renderWithRouter({ returnTo: '/library' });

    const connectButton = screen.getByText(/connect with tidal/i);
    fireEvent.click(connectButton);

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(RETURN_URL_KEY, '/library');
  });

  it('uses /discover as default return URL', () => {
    renderWithRouter();

    const connectButton = screen.getByText(/connect with tidal/i);
    fireEvent.click(connectButton);

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(RETURN_URL_KEY, '/discover');
  });

  it('displays error message when connection fails', () => {
    mockUseTidalAuth.mockReturnValue({
      error: 'Failed to connect to Tidal',
      isConnecting: false,
      initiateTidalLogin: mockInitiateTidalLogin,
      isInitialized: true,
    });

    renderWithRouter();

    expect(screen.getByText(/failed to connect to tidal/i)).toBeInTheDocument();
    expect(screen.getByText(/please try again/i)).toBeInTheDocument();
  });

  it('disables connect button while connecting', () => {
    mockUseTidalAuth.mockReturnValue({
      error: null,
      isConnecting: true,
      initiateTidalLogin: mockInitiateTidalLogin,
      isInitialized: true,
    });

    renderWithRouter();

    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('mentions privacy and credentials not being stored', () => {
    renderWithRouter();
    expect(screen.getByText(/credentials are never stored/i)).toBeInTheDocument();
  });
});
