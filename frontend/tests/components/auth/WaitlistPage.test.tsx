/**
 * Component tests for WaitlistPage
 *
 * Tests the waitlist page shown to non-approved users.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WaitlistPage } from '../../../src/pages/WaitlistPage';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  UserButton: () => <button data-testid="user-button">User</button>,
}));

describe('WaitlistPage', () => {
  const renderWaitlistPage = () => {
    return render(
      <BrowserRouter>
        <WaitlistPage />
      </BrowserRouter>
    );
  };

  it('renders thank you message', () => {
    renderWaitlistPage();
    expect(screen.getByText(/thanks for your interest/i)).toBeInTheDocument();
  });

  it('mentions private beta status', () => {
    renderWaitlistPage();
    const betaTexts = screen.getAllByText(/private beta/i);
    expect(betaTexts.length).toBeGreaterThan(0);
  });

  it('indicates user is on waitlist', () => {
    renderWaitlistPage();
    expect(screen.getByText(/on the waitlist/i)).toBeInTheDocument();
  });

  it('mentions email notification', () => {
    renderWaitlistPage();
    expect(screen.getByText(/notify you via email/i)).toBeInTheDocument();
  });

  it('mentions Tidal subscription requirement', () => {
    renderWaitlistPage();
    expect(screen.getByText(/tidal subscription/i)).toBeInTheDocument();
  });

  it('displays user button for sign out', () => {
    renderWaitlistPage();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('shows signed in indicator', () => {
    renderWaitlistPage();
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
  });
});
