/**
 * Tidal Connect Button
 *
 * Button component that initiates the Tidal OAuth flow.
 */

import { useTidalAuth } from '../../hooks/useTidalAuth';

interface TidalConnectButtonProps {
  disabled?: boolean;
  /** Called before initiating OAuth, useful for saving return URL */
  onBeforeConnect?: () => void;
}

export function TidalConnectButton({
  disabled = false,
  onBeforeConnect,
}: TidalConnectButtonProps): JSX.Element {
  const { initiateTidalLogin, isConnecting, isInitialized } = useTidalAuth();

  const handleClick = async () => {
    onBeforeConnect?.();
    await initiateTidalLogin();
  };

  const buttonDisabled = disabled || isConnecting || !isInitialized;

  return (
    <button
      className="auth-button"
      onClick={handleClick}
      disabled={buttonDisabled}
      type="button"
    >
      {isConnecting ? (
        <>
          <span className="spinner spinner--small" />
          Connecting...
        </>
      ) : (
        <>
          <TidalIcon />
          Connect with Tidal
        </>
      )}
    </button>
  );
}

/**
 * Tidal logo icon
 */
function TidalIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0L8 4L12 8L16 4L12 0Z" />
      <path d="M4 8L0 12L4 16L8 12L4 8Z" />
      <path d="M12 8L8 12L12 16L16 12L12 8Z" />
      <path d="M20 8L16 12L20 16L24 12L20 8Z" />
      <path d="M12 16L8 20L12 24L16 20L12 16Z" />
    </svg>
  );
}
