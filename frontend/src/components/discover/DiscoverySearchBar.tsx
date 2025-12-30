import { useState, FormEvent } from 'react';
import './DiscoverySearchBar.css';

/**
 * Search bar for semantic discovery search
 *
 * Feature: 009-semantic-discovery-search
 */

interface DiscoverySearchBarProps {
  /** Called when user submits a search */
  onSearch: (query: string) => void;
  /** Whether a search is in progress */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Initial query value */
  initialQuery?: string;
}

export function DiscoverySearchBar({
  onSearch,
  loading = false,
  error = null,
  initialQuery = '',
}: DiscoverySearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSearch(query.trim());
    }
  };

  const charCount = query.length;
  const maxChars = 2000;
  const charCountClass =
    charCount >= maxChars
      ? 'at-limit'
      : charCount >= maxChars * 0.9
      ? 'near-limit'
      : '';

  return (
    <form className="discovery-search-bar" onSubmit={handleSubmit}>
      <div className="discovery-search-input-container">
        <textarea
          className="discovery-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the mood, theme, or feeling you're looking for..."
          rows={3}
          maxLength={maxChars}
          disabled={loading}
        />
        <div className="discovery-search-input-footer">
          <div className="discovery-search-hint">
            Try something like "uplifting songs about hope" or "melancholic late night music"
          </div>
          <div className={`discovery-search-char-count ${charCountClass}`}>
            {charCount}/{maxChars}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="discovery-search-button"
        disabled={loading || !query.trim()}
      >
        {loading ? 'Searching...' : 'Discover'}
      </button>

      {error && <div className="discovery-search-error">{error}</div>}
    </form>
  );
}
