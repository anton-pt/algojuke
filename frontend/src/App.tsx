import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './graphql/client';
import { SearchPage } from './pages/SearchPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

export function App() {
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <SearchPage />
      </ApolloProvider>
    </ErrorBoundary>
  );
}
