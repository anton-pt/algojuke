/**
 * Readwise Connection Section
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 *
 * Allows users to connect/disconnect their Readwise account.
 */

import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  CONNECT_READWISE,
  DISCONNECT_READWISE,
  ConnectReadwiseData,
  DisconnectReadwiseData,
} from "../../graphql/settings";

interface ReadwiseConnectionSectionProps {
  isConnected: boolean;
  connectedAt: string | null;
  loading: boolean;
  onConnectionChange: () => void;
}

export function ReadwiseConnectionSection({
  isConnected,
  connectedAt,
  loading,
  onConnectionChange,
}: ReadwiseConnectionSectionProps): JSX.Element {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const [connectReadwise, { loading: connecting }] =
    useMutation<ConnectReadwiseData>(CONNECT_READWISE);

  const [disconnectReadwise, { loading: disconnecting }] =
    useMutation<DisconnectReadwiseData>(DISCONNECT_READWISE);

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("Token is required");
      return;
    }

    try {
      const { data } = await connectReadwise({
        variables: { accessToken: trimmedToken },
      });

      if (data?.connectReadwise.__typename === "ReadwiseConnectionSuccess") {
        setToken("");
        onConnectionChange();
      } else if (
        data?.connectReadwise.__typename === "ReadwiseValidationError"
      ) {
        setError(data.connectReadwise.message);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
  };

  const handleDisconnect = async () => {
    try {
      const { data } = await disconnectReadwise();

      if (data?.disconnectReadwise.__typename === "ReadwiseDisconnectSuccess") {
        setShowDisconnectDialog(false);
        onConnectionChange();
      } else if (
        data?.disconnectReadwise.__typename === "ReadwiseValidationError"
      ) {
        setError(data.disconnectReadwise.message);
        setShowDisconnectDialog(false);
      }
    } catch {
      setError("Failed to disconnect. Please try again.");
      setShowDisconnectDialog(false);
    }
  };

  return (
    <>
      <section
        className={`connection-section ${loading ? "connection-section--loading" : ""}`}
      >
        <div className="connection-section__header">
          <div className="connection-section__icon connection-section__icon--readwise">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 4h16v16H4V4z"
                stroke="#000"
                strokeWidth="2"
                fill="none"
              />
              <path d="M7 8h10M7 12h10M7 16h6" stroke="#000" strokeWidth="2" />
            </svg>
          </div>
          <div className="connection-section__title">
            <h2>Readwise</h2>
            <p>Import highlights from your reading</p>
          </div>
          <div
            className={`connection-section__status ${
              isConnected
                ? "connection-section__status--connected"
                : "connection-section__status--disconnected"
            }`}
          >
            <span className="connection-section__status-dot" />
            {loading
              ? "Loading..."
              : isConnected
                ? "Connected"
                : "Not connected"}
          </div>
        </div>

        <div className="connection-section__body">
          {isConnected && connectedAt ? (
            <div className="connection-section__connected-info">
              <p>Connected on {formatDate(connectedAt)}</p>
              <button
                className="btn btn--danger"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          ) : (
            <form className="connection-form" onSubmit={handleSubmit}>
              <p className="connection-form__info">
                Connect your Readwise account to import highlights from your
                reading.{" "}
                <a
                  href="https://readwise.io/access_token"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get your access token
                </a>
              </p>
              <p className="connection-form__note">
                Note: Readwise requires a paid subscription ($9.99+/month)
              </p>

              <div className="connection-form__input-group">
                <label htmlFor="readwise-token">Access Token</label>
                <input
                  id="readwise-token"
                  type="password"
                  className="connection-form__input"
                  placeholder="Enter your Readwise access token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={connecting}
                />
              </div>

              {error && (
                <div className="connection-form__error">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5a1 1 0 012 0v3a1 1 0 01-2 0V5zm1 7a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="connection-form__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={connecting || !token.trim()}
                >
                  {connecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {showDisconnectDialog && (
        <div
          className="confirmation-dialog"
          onClick={() => setShowDisconnectDialog(false)}
        >
          <div
            className="confirmation-dialog__content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Disconnect Readwise?</h3>
            <p>
              This will remove your Readwise connection. You can reconnect at
              any time by entering your access token again.
            </p>
            <div className="confirmation-dialog__actions">
              <button
                className="btn btn--outline"
                onClick={() => setShowDisconnectDialog(false)}
                disabled={disconnecting}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
