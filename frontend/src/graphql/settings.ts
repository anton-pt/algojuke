/**
 * GraphQL operations for Settings
 *
 * Feature: ALG-33 - Readwise Reader API Token Integration
 */

import { gql } from "@apollo/client";

/**
 * Query to get Tidal connection status
 */
export const GET_TIDAL_CONNECTION_STATUS = gql`
  query GetTidalConnectionStatus {
    tidalConnectionStatus {
      isConnected
      connectedAt
    }
  }
`;

/**
 * Query to get Readwise connection status
 */
export const GET_READWISE_CONNECTION_STATUS = gql`
  query GetReadwiseConnectionStatus {
    readwiseConnectionStatus {
      isConnected
      connectedAt
    }
  }
`;

/**
 * Combined query for settings page
 */
export const GET_CONNECTION_STATUSES = gql`
  query GetConnectionStatuses {
    tidalConnectionStatus {
      isConnected
      connectedAt
    }
    readwiseConnectionStatus {
      isConnected
      connectedAt
    }
  }
`;

/**
 * Mutation to connect Readwise
 */
export const CONNECT_READWISE = gql`
  mutation ConnectReadwise($accessToken: String!) {
    connectReadwise(accessToken: $accessToken) {
      __typename
      ... on ReadwiseConnectionSuccess {
        connectedAt
      }
      ... on ReadwiseValidationError {
        message
        code
      }
    }
  }
`;

/**
 * Mutation to disconnect Readwise
 */
export const DISCONNECT_READWISE = gql`
  mutation DisconnectReadwise {
    disconnectReadwise {
      __typename
      ... on ReadwiseDisconnectSuccess {
        success
      }
      ... on ReadwiseValidationError {
        message
        code
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// TypeScript Types
// ---------------------------------------------------------------------------

export interface TidalConnectionStatus {
  isConnected: boolean;
  connectedAt: string | null;
}

export interface ReadwiseConnectionStatus {
  isConnected: boolean;
  connectedAt: string | null;
}

export interface ReadwiseConnectionSuccess {
  __typename: "ReadwiseConnectionSuccess";
  connectedAt: string;
}

export interface ReadwiseValidationError {
  __typename: "ReadwiseValidationError";
  message: string;
  code:
    | "INVALID_TOKEN"
    | "TOKEN_REVOKED"
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "UNKNOWN";
}

export interface ReadwiseDisconnectSuccess {
  __typename: "ReadwiseDisconnectSuccess";
  success: boolean;
}

export type ConnectReadwiseResult =
  | ReadwiseConnectionSuccess
  | ReadwiseValidationError;

export type DisconnectReadwiseResult =
  | ReadwiseDisconnectSuccess
  | ReadwiseValidationError;

// Query response types
export interface GetTidalConnectionStatusData {
  tidalConnectionStatus: TidalConnectionStatus;
}

export interface GetReadwiseConnectionStatusData {
  readwiseConnectionStatus: ReadwiseConnectionStatus;
}

export interface GetConnectionStatusesData {
  tidalConnectionStatus: TidalConnectionStatus;
  readwiseConnectionStatus: ReadwiseConnectionStatus;
}

export interface ConnectReadwiseData {
  connectReadwise: ConnectReadwiseResult;
}

export interface DisconnectReadwiseData {
  disconnectReadwise: DisconnectReadwiseResult;
}
