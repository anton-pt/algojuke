import './IndexedBadge.css';

interface IndexedBadgeProps {
  /** Whether the track is indexed */
  isIndexed: boolean | undefined;
  /** Size variant */
  size?: 'small' | 'default';
}

/**
 * Visual indicator for indexed track status
 * Shows a badge when track has enriched metadata available
 *
 * Fail-open behavior: If isIndexed is undefined (Qdrant unavailable),
 * the badge is hidden rather than showing a false negative.
 */
export function IndexedBadge({ isIndexed, size = 'default' }: IndexedBadgeProps) {
  // Fail-open: hide badge when status is unknown or not indexed
  if (isIndexed !== true) {
    return null;
  }

  return (
    <span
      className={`indexed-badge indexed-badge--${size}`}
      title="Enhanced metadata available"
      aria-label="Track has enhanced metadata"
    >
      <svg
        className="indexed-badge-icon"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 0C3.58 0 0 3.58 0 8c0 4.42 3.58 8 8 8 4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8zm3.72 6.28l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L7.19 8.69l3.47-3.47a.75.75 0 111.06 1.06z" />
      </svg>
    </span>
  );
}
