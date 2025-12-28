import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { Toaster } from 'sonner';
import { apolloClient } from './graphql/client';
import { UndoDeleteProvider } from './contexts/UndoDeleteContext';
import { AppHeader } from './components/AppHeader';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

export function App() {
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <UndoDeleteProvider>
          <BrowserRouter>
            <Toaster position="bottom-right" richColors />
            <AppHeader />
            <Routes>
              <Route path="/" element={<SearchPage />} />
              <Route path="/library/*" element={<LibraryPage />} />
            </Routes>
          </BrowserRouter>
        </UndoDeleteProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}
