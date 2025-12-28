import { useState } from 'react';
import { useLazyQuery } from '@apollo/client';
import { SEARCH_QUERY } from '../graphql/queries';
import { SearchBar } from '../components/SearchBar';
import { ResultsList } from '../components/ResultsList';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import './SearchPage.css';

export function SearchPage() {
  const [searchQuery, { loading, error, data }] = useLazyQuery(SEARCH_QUERY);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = (query: string) => {
    setErrorMessage(null);

    searchQuery({
      variables: {
        query,
        limit: 20,
      },
    }).catch((err) => {
      setErrorMessage(err.message || 'Search failed. Please try again.');
    });
  };

  return (
    <div className="search-page">
      <header className="search-header">
        <h1>Tidal Music Search</h1>
        <p>Search for albums and tracks on Tidal</p>
      </header>

      <SearchBar
        onSearch={handleSearch}
        loading={loading}
        error={errorMessage || (error ? error.message : null)}
      />

      {loading && (
        <div className="loading-state">
          <LoadingSkeleton type="album" count={8} />
        </div>
      )}

      {!loading && data && <ResultsList results={data.search} />}
    </div>
  );
}
