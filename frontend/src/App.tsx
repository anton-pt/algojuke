import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { ApolloProviderWithAuth } from "./graphql/ApolloProviderWithAuth";
import { UndoDeleteProvider } from "./contexts/UndoDeleteContext";
import { AppHeader } from "./components/AppHeader";
import { LibraryPage } from "./pages/LibraryPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { LandingPage } from "./pages/LandingPage";
import { TidalConnectPage } from "./pages/TidalConnectPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CallbackPage } from "./pages/CallbackPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./App.css";

export function App() {
  return (
    <ErrorBoundary>
      <ApolloProviderWithAuth>
        <UndoDeleteProvider>
          <BrowserRouter>
            <Toaster position="bottom-right" richColors />
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth/tidal/callback" element={<CallbackPage />} />

              {/* Authenticated user routes (require auth but not Tidal) */}
              <Route
                path="/connect-tidal"
                element={
                  <ProtectedRoute requireTidal={false}>
                    <TidalConnectPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requireTidal={false}>
                    <AppHeader />
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected routes (require auth + Tidal) */}
              <Route
                path="/discover/*"
                element={
                  <ProtectedRoute requireTidal>
                    <AppHeader />
                    <DiscoverPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/library/*"
                element={
                  <ProtectedRoute requireTidal>
                    <AppHeader />
                    <LibraryPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </UndoDeleteProvider>
      </ApolloProviderWithAuth>
    </ErrorBoundary>
  );
}
