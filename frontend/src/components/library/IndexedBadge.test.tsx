import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IndexedBadge } from './IndexedBadge';

describe('IndexedBadge', () => {
  describe('visibility', () => {
    it('renders when isIndexed is true', () => {
      render(<IndexedBadge isIndexed={true} />);
      expect(screen.getByLabelText('Track has enhanced metadata')).toBeInTheDocument();
    });

    it('does not render when isIndexed is false', () => {
      const { container } = render(<IndexedBadge isIndexed={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render when isIndexed is undefined (fail-open)', () => {
      const { container } = render(<IndexedBadge isIndexed={undefined} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('size variants', () => {
    it('applies default size class when size is not specified', () => {
      render(<IndexedBadge isIndexed={true} />);
      const badge = screen.getByLabelText('Track has enhanced metadata');
      expect(badge).toHaveClass('indexed-badge--default');
    });

    it('applies small size class when size is small', () => {
      render(<IndexedBadge isIndexed={true} size="small" />);
      const badge = screen.getByLabelText('Track has enhanced metadata');
      expect(badge).toHaveClass('indexed-badge--small');
    });
  });

  describe('accessibility', () => {
    it('has accessible title attribute', () => {
      render(<IndexedBadge isIndexed={true} />);
      const badge = screen.getByLabelText('Track has enhanced metadata');
      expect(badge).toHaveAttribute('title', 'Enhanced metadata available');
    });

    it('has aria-hidden on the SVG icon', () => {
      render(<IndexedBadge isIndexed={true} />);
      const svg = document.querySelector('.indexed-badge-icon');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
