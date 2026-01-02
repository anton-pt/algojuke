/**
 * ToolInvocation Component Tests
 *
 * Feature: 011-agent-tools
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolInvocation, type ToolInvocationProps } from '../../../src/components/chat/ToolInvocation';

const defaultProps: ToolInvocationProps = {
  toolCallId: 'tc_123',
  toolName: 'semanticSearch',
  input: { query: 'melancholic songs', limit: 10 },
  status: 'executing',
};

describe('ToolInvocation', () => {
  describe('Executing state', () => {
    it('shows spinner and "Searching..." status', () => {
      render(<ToolInvocation {...defaultProps} />);

      expect(screen.getByText('Searching...')).toBeInTheDocument();
      expect(screen.getByText('Semantic Search')).toBeInTheDocument();
    });

    it('does not show chevron when executing', () => {
      const { container } = render(<ToolInvocation {...defaultProps} />);

      expect(container.querySelector('.tool-invocation__chevron')).not.toBeInTheDocument();
    });
  });

  describe('Completed state', () => {
    const completedProps: ToolInvocationProps = {
      ...defaultProps,
      status: 'completed',
      summary: 'Found 8 tracks matching "melancholic songs"',
      resultCount: 8,
      durationMs: 1234,
      output: {
        tracks: [
          { isrc: 'ABC123456789', title: 'Someone Like You', artist: 'Adele', inLibrary: true, isIndexed: true },
          { isrc: 'DEF123456789', title: 'Fix You', artist: 'Coldplay', inLibrary: false, isIndexed: true },
        ],
        query: 'melancholic songs',
        totalFound: 8,
        summary: 'Found 8 tracks',
        durationMs: 1234,
      },
    };

    it('shows "Done" status and summary', () => {
      render(<ToolInvocation {...completedProps} />);

      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Found 8 tracks matching "melancholic songs"')).toBeInTheDocument();
    });

    it('shows duration', () => {
      render(<ToolInvocation {...completedProps} />);

      expect(screen.getByText('1.2s')).toBeInTheDocument();
    });

    it('shows chevron when results available', () => {
      const { container } = render(<ToolInvocation {...completedProps} />);

      expect(container.querySelector('.tool-invocation__chevron')).toBeInTheDocument();
    });

    it('expands to show results on click', () => {
      render(<ToolInvocation {...completedProps} />);

      // Results not visible initially
      expect(screen.queryByText('Someone Like You')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByRole('button'));

      // Results now visible
      expect(screen.getByText('Someone Like You')).toBeInTheDocument();
      expect(screen.getByText('Adele')).toBeInTheDocument();
      expect(screen.getByText('Fix You')).toBeInTheDocument();
    });

    it('shows "In Library" badge for library tracks', () => {
      render(<ToolInvocation {...completedProps} />);

      // Expand first
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('In Library')).toBeInTheDocument();
    });
  });

  describe('Failed state', () => {
    const failedProps: ToolInvocationProps = {
      ...defaultProps,
      status: 'failed',
      error: 'Vector search service is temporarily unavailable',
    };

    it('shows "Failed" status', () => {
      render(<ToolInvocation {...failedProps} />);

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('shows error message', () => {
      render(<ToolInvocation {...failedProps} />);

      expect(screen.getByText('Vector search service is temporarily unavailable')).toBeInTheDocument();
    });
  });

  describe('Tool name formatting', () => {
    it('formats semanticSearch as "Semantic Search"', () => {
      render(<ToolInvocation {...defaultProps} toolName="semanticSearch" />);
      expect(screen.getByText('Semantic Search')).toBeInTheDocument();
    });

    it('formats tidalSearch as "Tidal Search"', () => {
      render(<ToolInvocation {...defaultProps} toolName="tidalSearch" />);
      expect(screen.getByText('Tidal Search')).toBeInTheDocument();
    });

    it('formats batchMetadata as "Batch Metadata"', () => {
      render(<ToolInvocation {...defaultProps} toolName="batchMetadata" />);
      expect(screen.getByText('Batch Metadata')).toBeInTheDocument();
    });

    it('formats albumTracks as "Album Tracks"', () => {
      render(<ToolInvocation {...defaultProps} toolName="albumTracks" />);
      expect(screen.getByText('Album Tracks')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    const completedProps: ToolInvocationProps = {
      ...defaultProps,
      status: 'completed',
      summary: 'Found 5 tracks',
      resultCount: 5,
      output: { tracks: [{ isrc: 'ABC', title: 'Test', artist: 'Artist', inLibrary: false, isIndexed: true }] },
    };

    it('has role="button" when expandable', () => {
      render(<ToolInvocation {...completedProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('expands on Enter key', () => {
      render(<ToolInvocation {...completedProps} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('expands on Space key', () => {
      render(<ToolInvocation {...completedProps} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });
});
