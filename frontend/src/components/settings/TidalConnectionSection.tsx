/**
 * Tidal Connection Section
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 *
 * Displays the user's Tidal connection status (read-only).
 */

interface TidalConnectionSectionProps {
  isConnected: boolean;
  connectedAt: string | null;
  loading: boolean;
}

export function TidalConnectionSection({
  isConnected,
  connectedAt,
  loading,
}: TidalConnectionSectionProps): JSX.Element {
  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <section
      className={`connection-section ${loading ? "connection-section--loading" : ""}`}
    >
      <div className="connection-section__header">
        <div className="connection-section__icon connection-section__icon--tidal">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 4L8 8L12 12L16 8L12 4Z" fill="white" />
            <path d="M4 8L0 12L4 16L8 12L4 8Z" fill="white" />
            <path d="M12 12L8 16L12 20L16 16L12 12Z" fill="white" />
            <path d="M20 8L16 12L20 16L24 12L20 8Z" fill="white" />
          </svg>
        </div>
        <div className="connection-section__title">
          <h2>Tidal</h2>
          <p>Your music streaming service</p>
        </div>
        <div
          className={`connection-section__status ${
            isConnected
              ? "connection-section__status--connected"
              : "connection-section__status--disconnected"
          }`}
        >
          <span className="connection-section__status-dot" />
          {loading ? "Loading..." : isConnected ? "Connected" : "Not connected"}
        </div>
      </div>

      {isConnected && connectedAt && (
        <div className="connection-section__body">
          <div className="connection-section__connected-info">
            <p>Connected on {formatDate(connectedAt)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
