import { AlbumCard } from './AlbumCard';
import { TrackCard } from './TrackCard';
import { NoResultsMessage } from './NoResultsMessage';
import './ResultsList.css';

interface ResultsListProps {
  results: {
    albums: Array<{
      id: string;
      title: string;
      artist: string;
      artists: string[];
      artworkUrl: string;
      artworkThumbUrl: string;
      explicit: boolean;
      trackCount: number;
      duration: number;
      releaseDate: string;
      externalUrl: string;
      source: string;
    }>;
    tracks: Array<{
      id: string;
      title: string;
      artist: string;
      artists: string[];
      albumTitle: string;
      albumId: string;
      artworkUrl: string;
      artworkThumbUrl: string;
      explicit: boolean;
      duration: number;
      externalUrl: string;
      source: string;
    }>;
    total: {
      albums: number;
      tracks: number;
    };
    query: string;
    cached: boolean;
    timestamp: number;
  } | null;
}

export function ResultsList({ results }: ResultsListProps) {
  if (!results) {
    return null;
  }

  const { albums, tracks, total, cached, query } = results;
  const hasResults = albums.length > 0 || tracks.length > 0;

  if (!hasResults) {
    return <NoResultsMessage query={query} />;
  }

  return (
    <div className="results-list">
      <div className="results-header">
        <p>
          Found {total.albums} albums and {total.tracks} tracks
          {cached && <span className="cached-badge">Cached</span>}
        </p>
      </div>

      {albums.length > 0 && (
        <section className="albums-section">
          <h2>Albums ({total.albums})</h2>
          <div className="albums-grid">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {tracks.length > 0 && (
        <section className="tracks-section">
          <h2>Tracks ({total.tracks})</h2>
          <div className="tracks-list">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
