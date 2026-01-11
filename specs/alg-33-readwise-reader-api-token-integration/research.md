# Research: Readwise Reader API Token Integration

**Date**: 2026-01-11
**Feature**: ALG-33
**Implementation Guidance**: None provided

## Executive Summary

This feature adds Readwise token management via a new Settings page. Key decisions:

1. Use GraphQL union types for typed error responses (following tidalSync.graphql pattern)
2. Create separate `readwiseAuthService.ts` (parallel to tidalAuthService.ts)
3. Store tokens in Clerk private metadata at `user.privateMetadata.readwise`
4. New `/settings` route with protected access

## Key Decisions

### 1. GraphQL Schema Design

**Decision**: Use union types for result responses, matching the tidalSync.graphql pattern.

**Rationale**: The codebase consistently uses union types (e.g., `TidalAlbumDiffUnion = TidalAlbumDiffResult | TidalSyncConnectionError | TidalSyncApiError`) for operations that can fail in typed ways. This allows the frontend to handle different error types distinctly.

**Alternatives Considered**:

- Throwing GraphQL errors: Rejected because it loses type safety and doesn't allow distinguishing error types easily in the frontend.
- Nullable result with separate error field: Rejected because unions are the established pattern.

**Schema Design**:

```graphql
# settings.graphql

type ReadwiseConnectionStatus {
  isConnected: Boolean!
  connectedAt: String # ISO timestamp, null if not connected
}

type ReadwiseConnectionSuccess {
  connectedAt: String!
}

type ReadwiseValidationError {
  message: String!
  code: ReadwiseErrorCode!
}

enum ReadwiseErrorCode {
  INVALID_TOKEN
  TOKEN_REVOKED
  NETWORK_ERROR
  TIMEOUT
  UNKNOWN
}

type ReadwiseDisconnectSuccess {
  success: Boolean!
}

union ConnectReadwiseResult =
  | ReadwiseConnectionSuccess
  | ReadwiseValidationError

union DisconnectReadwiseResult =
  | ReadwiseDisconnectSuccess
  | ReadwiseValidationError

type Query {
  readwiseConnectionStatus: ReadwiseConnectionStatus!
}

type Mutation {
  connectReadwise(accessToken: String!): ConnectReadwiseResult!
  disconnectReadwise: DisconnectReadwiseResult!
}
```

### 2. Error Handling Strategy

**Decision**: Map Readwise API responses to typed error codes in `ReadwiseErrorCode` enum.

**Rationale**: The spec requires specific error messages for different failure modes (invalid token, revoked token, network error, timeout). Using an enum allows the frontend to display context-appropriate messages.

**Mapping**:
| Readwise Response | Error Code | Frontend Message |
|-------------------|------------|------------------|
| HTTP 204 | Success | - |
| HTTP 401 | `TOKEN_REVOKED` | "Token is invalid or has been revoked. Please generate a new token." |
| HTTP 4xx (other) | `INVALID_TOKEN` | "Invalid token. Please check your token and try again." |
| Network error | `NETWORK_ERROR` | "Unable to verify token. Please try again later." |
| Timeout (10s) | `TIMEOUT` | "Connection timed out. Please try again." |
| Other | `UNKNOWN` | "Unable to verify token. Please try again later." |

### 3. Service Architecture

**Decision**: Create new `readwiseAuthService.ts` following the `tidalAuthService.ts` pattern.

**Rationale**: Readwise token management is simpler than Tidal (no refresh token, no scopes, no expiration) but benefits from the same separation of concerns. Keeping it separate allows future Readwise features to extend the service.

**Service Functions**:

```typescript
// readwiseAuthService.ts
export async function getReadwiseTokens(
  userId: string,
): Promise<ReadwiseTokens | null>;
export async function storeReadwiseTokens(
  userId: string,
  accessToken: string,
): Promise<number>;
export async function hasReadwiseConnection(userId: string): Promise<boolean>;
export async function clearReadwiseTokens(userId: string): Promise<void>;
export async function validateReadwiseToken(
  accessToken: string,
): Promise<{ valid: boolean; errorCode?: ReadwiseErrorCode }>;
```

### 4. Token Storage Schema

**Decision**: Use a simplified schema compared to Tidal (no refresh token, no expiration, no scopes).

**Rationale**: Readwise uses simple token auth, not OAuth. Tokens are long-lived until manually revoked. No refresh mechanism exists.

**Schema**:

```typescript
// backend/src/schemas/auth.ts (addition)

export const ReadwiseTokensSchema = z.object({
  accessToken: z.string().min(1),
  connectedAt: z.number().positive(),
});

export type ReadwiseTokens = z.infer<typeof ReadwiseTokensSchema>;
```

**Clerk Metadata Structure**:

```json
{
  "privateMetadata": {
    "tidal": { ... },
    "readwise": {
      "accessToken": "xxx",
      "connectedAt": 1704931200000
    }
  }
}
```

### 5. Frontend Page Structure

**Decision**: Create a new `/settings` route with a dedicated SettingsPage component containing sections for each connection type.

**Rationale**: A centralized Settings page provides a consistent location for managing external connections. The page uses the same protected route pattern as other authenticated pages.

**Component Structure**:

```
frontend/src/pages/SettingsPage.tsx
├── TidalConnectionSection (read-only status display)
└── ReadwiseConnectionSection
    ├── Connected state: status + disconnect button
    └── Disconnected state: form + instructions
```

### 6. Navigation Integration

**Decision**: Add Settings link via Clerk's UserButton customization (if possible) or as a separate nav item.

**Rationale**: Clerk's UserButton already provides user menu functionality. If it supports custom menu items, that's the cleanest integration. Otherwise, a Settings link in the header navigation works.

**Alternatives Considered**:

- Dedicated settings icon in header: More visible but adds visual clutter.
- Settings as a tab in an existing page: Rejected because settings deserve their own route for bookmarking and clarity.

## Implementation Patterns

### Token Storage Pattern (from tidalAuthService.ts)

```typescript
// Getting tokens
export async function getReadwiseTokens(
  userId: string,
): Promise<ReadwiseTokens | null> {
  const user = await clerkClient.users.getUser(userId);
  const readwiseData = user.privateMetadata?.readwise;

  if (!readwiseData) return null;

  const parsed = ReadwiseTokensSchema.safeParse(readwiseData);
  if (!parsed.success) {
    logger.warn("readwise_tokens_invalid", {
      userId,
      errors: parsed.error.issues,
    });
    return null;
  }

  return parsed.data;
}

// Storing tokens
export async function storeReadwiseTokens(
  userId: string,
  accessToken: string,
): Promise<number> {
  const connectedAt = Date.now();

  await clerkClient.users.updateUserMetadata(userId, {
    privateMetadata: {
      readwise: { accessToken, connectedAt },
    },
  });

  logger.info("readwise_tokens_stored", { userId, connectedAt });
  return connectedAt;
}

// Clearing tokens
export async function clearReadwiseTokens(userId: string): Promise<void> {
  await clerkClient.users.updateUserMetadata(userId, {
    privateMetadata: {
      readwise: null,
    },
  });

  logger.info("readwise_tokens_cleared", { userId });
}
```

### GraphQL Resolver Pattern (from tidalSyncResolver.ts)

```typescript
// settingsResolver.ts
const resolvers = {
  Query: {
    readwiseConnectionStatus: async (_parent, _args, context) => {
      const userId = context.userId;
      if (!userId) {
        return { isConnected: false, connectedAt: null };
      }

      const tokens = await getReadwiseTokens(userId);
      return {
        isConnected: tokens !== null,
        connectedAt: tokens?.connectedAt
          ? new Date(tokens.connectedAt).toISOString()
          : null,
      };
    },
  },

  Mutation: {
    connectReadwise: async (_parent, { accessToken }, context) => {
      const userId = context.userId;
      if (!userId) {
        return {
          __typename: "ReadwiseValidationError",
          message: "Authentication required",
          code: "UNKNOWN",
        };
      }

      // Validate token with Readwise API
      const validation = await validateReadwiseToken(accessToken);
      if (!validation.valid) {
        return {
          __typename: "ReadwiseValidationError",
          message: getErrorMessage(validation.errorCode),
          code: validation.errorCode,
        };
      }

      // Store token
      const connectedAt = await storeReadwiseTokens(userId, accessToken);

      return {
        __typename: "ReadwiseConnectionSuccess",
        connectedAt: new Date(connectedAt).toISOString(),
      };
    },

    disconnectReadwise: async (_parent, _args, context) => {
      const userId = context.userId;
      if (!userId) {
        return {
          __typename: "ReadwiseValidationError",
          message: "Authentication required",
          code: "UNKNOWN",
        };
      }

      await clearReadwiseTokens(userId);

      return {
        __typename: "ReadwiseDisconnectSuccess",
        success: true,
      };
    },
  },

  // Union type resolvers
  ConnectReadwiseResult: {
    __resolveType: (obj) => obj.__typename,
  },
  DisconnectReadwiseResult: {
    __resolveType: (obj) => obj.__typename,
  },
};
```

### Token Validation Implementation

```typescript
// readwiseAuthService.ts
const READWISE_AUTH_URL = "https://readwise.io/api/v2/auth/";
const VALIDATION_TIMEOUT_MS = 10000;

export async function validateReadwiseToken(
  accessToken: string,
): Promise<{ valid: boolean; errorCode?: ReadwiseErrorCode }> {
  try {
    const response = await axios.get(READWISE_AUTH_URL, {
      headers: {
        Authorization: `Token ${accessToken}`,
      },
      timeout: VALIDATION_TIMEOUT_MS,
      validateStatus: () => true, // Don't throw on non-2xx
    });

    if (response.status === 204) {
      return { valid: true };
    }

    if (response.status === 401) {
      return { valid: false, errorCode: "TOKEN_REVOKED" };
    }

    return { valid: false, errorCode: "INVALID_TOKEN" };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        return { valid: false, errorCode: "TIMEOUT" };
      }
      return { valid: false, errorCode: "NETWORK_ERROR" };
    }
    return { valid: false, errorCode: "UNKNOWN" };
  }
}
```

## Files to Modify

### Backend (New Files)

| File                                          | Purpose                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `backend/src/services/readwiseAuthService.ts` | Token validation, storage, retrieval, clearing |
| `backend/src/schema/settings.graphql`         | GraphQL types, queries, mutations              |
| `backend/src/resolvers/settingsResolver.ts`   | GraphQL resolver implementation                |

### Backend (Modify)

| File                          | Change                                |
| ----------------------------- | ------------------------------------- |
| `backend/src/schemas/auth.ts` | Add `ReadwiseTokensSchema`            |
| `backend/src/server.ts`       | Register settings schema and resolver |

### Frontend (New Files)

| File                                                             | Purpose                       |
| ---------------------------------------------------------------- | ----------------------------- |
| `frontend/src/pages/SettingsPage.tsx`                            | Main settings page component  |
| `frontend/src/pages/SettingsPage.css`                            | Styles for settings page      |
| `frontend/src/components/settings/TidalConnectionSection.tsx`    | Tidal status display          |
| `frontend/src/components/settings/ReadwiseConnectionSection.tsx` | Readwise form/status          |
| `frontend/src/graphql/settings.ts`                               | GraphQL queries and mutations |

### Frontend (Modify)

| File                   | Change                |
| ---------------------- | --------------------- |
| `frontend/src/App.tsx` | Add `/settings` route |

## Verification Plan

1. **Unit Tests**:
   - `readwiseAuthService` functions with mocked Clerk client
   - Token validation with mocked axios responses

2. **Integration Tests**:
   - GraphQL resolver tests with mocked services
   - Settings page component tests

3. **Manual Testing**:
   - Navigate to /settings, verify page loads
   - Enter valid Readwise token, verify connection success
   - Enter invalid token, verify error message
   - Disconnect, verify status updates
   - Verify Tidal section shows correct status
