/**
 * DiscoverNav Component Tests
 *
 * Feature: 010-discover-chat
 * Task: T021-CT
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { StreamingProvider } from '../../../contexts/StreamingContext';
import { DiscoverNav } from '../DiscoverNav';

// Helper to render with router context
function renderWithRouter(initialPath: string = '/discover/search') {
  // Create a mock StreamingContext provider that we can control
  const MockStreamingProvider = ({ children }: { children: React.ReactNode }) => {
    return (
      <StreamingProvider>
        {children}
      </StreamingProvider>
    );
  };

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MockStreamingProvider>
        <DiscoverNav />
        <Routes>
          <Route path="/discover/search" element={<div data-testid="search-page">Search Page</div>} />
          <Route path="/discover/chat" element={<div data-testid="chat-page">Chat Page</div>} />
        </Routes>
      </MockStreamingProvider>
    </MemoryRouter>
  );
}

describe('DiscoverNav', () => {
  it('renders Search and Chat tabs', () => {
    renderWithRouter();

    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('marks Search tab as active when on search page', () => {
    renderWithRouter('/discover/search');

    const searchLink = screen.getByText('Search');
    expect(searchLink).toHaveClass('active');

    const chatLink = screen.getByText('Chat');
    expect(chatLink).not.toHaveClass('active');
  });

  it('marks Chat tab as active when on chat page', () => {
    renderWithRouter('/discover/chat');

    const chatLink = screen.getByText('Chat');
    expect(chatLink).toHaveClass('active');

    const searchLink = screen.getByText('Search');
    expect(searchLink).not.toHaveClass('active');
  });

  it('navigates to chat when Chat tab is clicked', () => {
    renderWithRouter('/discover/search');

    fireEvent.click(screen.getByText('Chat'));

    expect(screen.getByTestId('chat-page')).toBeInTheDocument();
  });

  it('navigates to search when Search tab is clicked', () => {
    renderWithRouter('/discover/chat');

    fireEvent.click(screen.getByText('Search'));

    expect(screen.getByTestId('search-page')).toBeInTheDocument();
  });

  it('uses NavLink for proper active state styling', () => {
    renderWithRouter('/discover/search');

    const searchLink = screen.getByText('Search');
    const chatLink = screen.getByText('Chat');

    expect(searchLink).toHaveClass('nav-link');
    expect(chatLink).toHaveClass('nav-link');
  });

  it('has correct links to routes', () => {
    renderWithRouter();

    const searchLink = screen.getByText('Search').closest('a');
    const chatLink = screen.getByText('Chat').closest('a');

    expect(searchLink).toHaveAttribute('href', '/discover/search');
    expect(chatLink).toHaveAttribute('href', '/discover/chat');
  });
});
