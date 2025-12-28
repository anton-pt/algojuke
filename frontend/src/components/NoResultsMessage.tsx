import './NoResultsMessage.css';

interface NoResultsMessageProps {
  query: string;
}

export function NoResultsMessage({ query }: NoResultsMessageProps) {
  return (
    <div className="no-results" role="status">
      <h2>No results found</h2>

      {query && (
        <p className="query-display">
          No results for "<strong>{query}</strong>"
        </p>
      )}

      <div className="suggestions">
        <p>Suggestions:</p>
        <ul>
          <li>Try different search terms</li>
          <li>Check your spelling</li>
          <li>Use more general keywords</li>
          <li>Try searching for the artist name or album title separately</li>
        </ul>
      </div>
    </div>
  );
}
