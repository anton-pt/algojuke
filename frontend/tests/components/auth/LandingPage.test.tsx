/**
 * Component tests for LandingPage
 *
 * Tests the public landing page explaining AlgoJuke service.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LandingPage } from '../../../src/pages/LandingPage';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sign-in-button">{children}</div>
  ),
  useUser: () => ({
    isSignedIn: false,
    isLoaded: true,
  }),
}));

// Mock react-router-dom's useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('LandingPage', () => {
  const renderLandingPage = () => {
    return render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
  };

  it('displays AlgoJuke branding', () => {
    renderLandingPage();
    expect(screen.getByText('AlgoJuke')).toBeInTheDocument();
  });

  it('describes AI-powered music discovery', () => {
    renderLandingPage();
    expect(screen.getByText(/ai-powered music discovery/i)).toBeInTheDocument();
  });

  it('mentions private beta status', () => {
    renderLandingPage();
    const betaTexts = screen.getAllByText(/private beta/i);
    expect(betaTexts.length).toBeGreaterThan(0);
  });

  it('lists key features', () => {
    renderLandingPage();
    expect(screen.getByText(/semantic search/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-powered music recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/playlist generation/i)).toBeInTheDocument();
  });

  it('displays sign in button', () => {
    renderLandingPage();
    expect(screen.getByTestId('sign-in-button')).toBeInTheDocument();
  });

  it('has sign in with google button', () => {
    renderLandingPage();
    expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
  });
});
