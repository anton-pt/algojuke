import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoResultsMessage } from './NoResultsMessage';

describe('NoResultsMessage Component', () => {
  test('renders no results heading', () => {
    render(<NoResultsMessage query="test query" />);

    expect(screen.getByRole('heading', { name: /no results found/i })).toBeInTheDocument();
  });

  test('displays helpful suggestions text', () => {
    render(<NoResultsMessage query="test query" />);

    expect(screen.getByText(/try different search terms/i)).toBeInTheDocument();
  });

  test('suggests checking spelling', () => {
    render(<NoResultsMessage query="test query" />);

    expect(screen.getByText(/check your spelling/i)).toBeInTheDocument();
  });

  test('displays the search query that returned no results', () => {
    render(<NoResultsMessage query="xyznotarealband" />);

    expect(screen.getByText(/xyznotarealband/i)).toBeInTheDocument();
  });

  test('provides actionable suggestions', () => {
    render(<NoResultsMessage query="test" />);

    const suggestions = screen.getByText(/suggestions/i);
    expect(suggestions).toBeInTheDocument();
  });

  test('has appropriate ARIA role for accessibility', () => {
    render(<NoResultsMessage query="test" />);

    const message = screen.getByRole('status');
    expect(message).toBeInTheDocument();
  });

  test('renders with minimal styling', () => {
    const { container } = render(<NoResultsMessage query="test" />);

    const noResultsDiv = container.querySelector('.no-results');
    expect(noResultsDiv).toBeInTheDocument();
  });

  test('displays empty query message appropriately', () => {
    render(<NoResultsMessage query="" />);

    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  test('handles long query strings', () => {
    const longQuery = 'a'.repeat(200);
    render(<NoResultsMessage query={longQuery} />);

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  test('handles special characters in query', () => {
    render(<NoResultsMessage query="AC/DC & Beyoncé" />);

    expect(screen.getByText(/AC\/DC & Beyoncé/i)).toBeInTheDocument();
  });

  test('provides multiple suggestion options', () => {
    render(<NoResultsMessage query="test" />);

    // Should have at least 2-3 suggestions
    expect(screen.getByText(/try different search terms/i)).toBeInTheDocument();
    expect(screen.getByText(/check your spelling/i)).toBeInTheDocument();
  });

  test('message is visually distinct', () => {
    const { container } = render(<NoResultsMessage query="test" />);

    const message = container.querySelector('.no-results');
    expect(message).toHaveClass('no-results');
  });
});
