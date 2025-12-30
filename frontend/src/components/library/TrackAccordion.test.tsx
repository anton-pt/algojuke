import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrackAccordion } from './TrackAccordion';
import { ExtendedTrackMetadata } from '../../graphql/trackMetadata';

// Mock TrackMetadataPanel to simplify accordion tests
vi.mock('./TrackMetadataPanel', () => ({
  TrackMetadataPanel: ({ loading, error }: { loading: boolean; error: Error | null }) => (
    <div data-testid="mock-metadata-panel">
      {loading && <span>Loading...</span>}
      {error && <span>Error</span>}
      {!loading && !error && <span>Content</span>}
    </div>
  ),
}));

describe('TrackAccordion', () => {
  const mockOnToggle = vi.fn();
  const mockOnRetry = vi.fn();

  const defaultProps = {
    trackId: 'track-123',
    isrc: 'USRC12345678',
    isExpanded: false,
    onToggle: mockOnToggle,
    loading: false,
    error: null,
    metadata: null as ExtendedTrackMetadata | null,
    onRetry: mockOnRetry,
  };

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnRetry.mockClear();
  });

  describe('collapsed state', () => {
    it('renders children (track content)', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByText('Track Content')).toBeInTheDocument();
    });

    it('does not show the panel when collapsed', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.queryByTestId('mock-metadata-panel')).not.toBeInTheDocument();
    });

    it('shows chevron pointing down', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByText('▼')).toHaveClass('down');
    });
  });

  describe('expanded state', () => {
    it('shows the metadata panel when expanded', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByTestId('mock-metadata-panel')).toBeInTheDocument();
    });

    it('shows chevron pointing up', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByText('▼')).toHaveClass('up');
    });

    it('has expanded class on accordion container', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByTestId('track-accordion-track-123')).toHaveClass('expanded');
    });
  });

  describe('interaction', () => {
    it('calls onToggle when header is clicked', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle when Enter key is pressed', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onToggle when Space key is pressed', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('does not call onToggle for other keys', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
      expect(mockOnToggle).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct aria-expanded when collapsed', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    });

    it('has correct aria-expanded when expanded', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-controls pointing to the panel', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-controls',
        'track-accordion-panel-track-123'
      );
    });

    it('panel has role="region" when expanded', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('header is focusable', () => {
      render(
        <TrackAccordion {...defaultProps}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('loading state passthrough', () => {
    it('passes loading state to panel', () => {
      render(
        <TrackAccordion {...defaultProps} isExpanded={true} loading={true}>
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('error state passthrough', () => {
    it('passes error state to panel', () => {
      render(
        <TrackAccordion
          {...defaultProps}
          isExpanded={true}
          error={new Error('Test error')}
        >
          <div>Track Content</div>
        </TrackAccordion>
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });
});
