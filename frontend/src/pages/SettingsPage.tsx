/**
 * Settings Page
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 *
 * Allows users to manage their external service connections (Tidal, Readwise).
 */

import { useQuery } from "@apollo/client";
import {
  GET_CONNECTION_STATUSES,
  GetConnectionStatusesData,
} from "../graphql/settings";
import { TidalConnectionSection } from "../components/settings/TidalConnectionSection";
import { ReadwiseConnectionSection } from "../components/settings/ReadwiseConnectionSection";
import "./SettingsPage.css";

export function SettingsPage(): JSX.Element {
  const { data, loading, error, refetch } = useQuery<GetConnectionStatusesData>(
    GET_CONNECTION_STATUSES,
  );

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Manage your external service connections</p>
      </header>

      {error && (
        <div className="settings-error">
          <p>Failed to load connection statuses. Please try again.</p>
          <button onClick={() => refetch()}>Retry</button>
        </div>
      )}

      <div className="settings-sections">
        <TidalConnectionSection
          isConnected={data?.tidalConnectionStatus.isConnected ?? false}
          connectedAt={data?.tidalConnectionStatus.connectedAt ?? null}
          loading={loading}
        />

        <ReadwiseConnectionSection
          isConnected={data?.readwiseConnectionStatus.isConnected ?? false}
          connectedAt={data?.readwiseConnectionStatus.connectedAt ?? null}
          loading={loading}
          onConnectionChange={() => refetch()}
        />
      </div>
    </div>
  );
}
