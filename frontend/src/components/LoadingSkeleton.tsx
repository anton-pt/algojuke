import './LoadingSkeleton.css';

/**
 * Skeleton component for album cards
 * Shows placeholder while album data is loading
 */
export function AlbumSkeleton() {
  return (
    <div className="skeleton-card album-skeleton" role="status" aria-label="Loading album">
      <div className="skeleton-artwork"></div>
      <div className="skeleton-content">
        <div className="skeleton-title"></div>
        <div className="skeleton-artist"></div>
        <div className="skeleton-meta-row">
          <div className="skeleton-meta-item"></div>
          <div className="skeleton-meta-item"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton component for track cards
 * Shows placeholder while track data is loading
 */
export function TrackSkeleton() {
  return (
    <div className="skeleton-card track-skeleton" role="status" aria-label="Loading track">
      <div className="skeleton-artwork-small"></div>
      <div className="skeleton-content">
        <div className="skeleton-title-small"></div>
        <div className="skeleton-artist-small"></div>
        <div className="skeleton-meta-row">
          <div className="skeleton-meta-item-small"></div>
        </div>
      </div>
    </div>
  );
}

/**
 * Container for multiple skeleton cards
 * @param count - Number of skeleton cards to display
 * @param type - Type of skeleton ('album' or 'track')
 */
interface LoadingSkeletonProps {
  count?: number;
  type: 'album' | 'track';
}

export function LoadingSkeleton({ count = 8, type }: LoadingSkeletonProps) {
  const SkeletonComponent = type === 'album' ? AlbumSkeleton : TrackSkeleton;

  return (
    <div className="skeleton-container">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonComponent key={index} />
      ))}
    </div>
  );
}
