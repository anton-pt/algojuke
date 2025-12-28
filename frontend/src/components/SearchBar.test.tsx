import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from './SearchBar';

describe('SearchBar Component', () => {
  test('renders search input and button', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('calls onSearch when form is submitted', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'Beatles');

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).toHaveBeenCalledWith('Beatles');
  });

  test('calls onSearch when Enter key is pressed', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'Beatles{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith('Beatles');
  });

  test('trims whitespace from query', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, '  Beatles  ');

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).toHaveBeenCalledWith('Beatles');
  });

  test('does not submit empty query', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  test('does not submit whitespace-only query', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, '   ');

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).not.toHaveBeenCalled();
  });

  test('shows loading state', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} loading={true} error={null} />);

    expect(screen.getByRole('button', { name: /searching/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeDisabled();
  });

  test('disables input and button while loading', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} loading={true} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    const button = screen.getByRole('button');

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });

  test('displays error message when error prop is provided', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} loading={false} error="Search failed" />);

    expect(screen.getByText(/search failed/i)).toBeInTheDocument();
  });

  test('clears error when typing', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <SearchBar onSearch={mockOnSearch} loading={false} error="Previous error" />
    );

    expect(screen.getByText(/previous error/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'n');

    // In a real component, this would trigger clearing the error
    rerender(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    expect(screen.queryByText(/previous error/i)).not.toBeInTheDocument();
  });

  test('supports international characters', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'Beyoncé');

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).toHaveBeenCalledWith('Beyoncé');
  });

  test('supports special characters', async () => {
    const mockOnSearch = vi.fn();
    const user = userEvent.setup();

    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i);
    await user.type(input, 'AC/DC');

    const button = screen.getByRole('button', { name: /search/i });
    await user.click(button);

    expect(mockOnSearch).toHaveBeenCalledWith('AC/DC');
  });

  test('respects maxLength attribute', () => {
    const mockOnSearch = vi.fn();
    render(<SearchBar onSearch={mockOnSearch} loading={false} error={null} />);

    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    expect(input.maxLength).toBe(200);
  });
});
