# ALG-84: API Key Auth for Service-to-Service Communication

## Summary

Enable the worker service to call backend GraphQL mutations using API key authentication for internal operations like updating mix status and segments.

## Problem Statement

The worker service needs to update mix records during generation (status changes, segment additions). Currently, MixService methods require userId for ownership verification, but worker operations are internal system operations that don't represent a specific user action - they update pre-owned data created by the user who initiated the mix.

## Solution

Create internal-only GraphQL mutations that:

1. Only accept service API key authentication (not user auth)
2. Look up mix by ID only (no userId ownership filter)
3. Are clearly marked as internal in the schema

## User Stories

### US-1: Internal Status Updates

**As** the worker service
**I want** to update mix status without user context
**So that** I can report generation progress and failures

**Acceptance Criteria:**

- `internalUpdateMixStatus` mutation accepts mixId, status, and optional failureReason
- Mutation requires valid `X-API-Key` header matching `SERVICE_API_KEY`
- Returns updated Mix or MixError
- Rejects requests without valid API key

### US-2: Internal Segment Updates

**As** the worker service
**I want** to update mix segments without user context
**So that** I can populate the mix with generated content

**Acceptance Criteria:**

- `internalUpdateMixSegments` mutation accepts mixId, segments array, totalDurationMs, and characterCount
- Mutation requires valid `X-API-Key` header matching `SERVICE_API_KEY`
- Returns updated Mix or MixError
- Rejects requests without valid API key

### US-3: Worker Backend Client

**As** a developer
**I want** a typed client for calling backend mutations
**So that** worker functions can easily update mix state

**Acceptance Criteria:**

- BackendClient provides `updateMixStatus()` and `updateMixSegments()` methods
- Client includes `X-API-Key` header in all requests
- Proper error handling with retryable/non-retryable classification
- Zod schemas validate inputs and outputs

## Technical Design

### Architecture

```
┌─────────────────┐     HTTP/GraphQL      ┌─────────────────────┐
│                 │  ───────────────────► │                     │
│  Worker Service │     X-API-Key         │  Backend Service    │
│                 │  ◄─────────────────── │                     │
└─────────────────┘                       └─────────────────────┘
        │                                           │
        │                                           │
        ▼                                           ▼
 ┌──────────────┐                          ┌──────────────┐
 │ BackendClient│                          │ MixService   │
 │              │                          │ (internal)   │
 └──────────────┘                          └──────────────┘
```

### Files Modified

| File                                    | Change                                 |
| --------------------------------------- | -------------------------------------- |
| `backend/src/middleware/serviceAuth.ts` | Add `requireServiceAuth()` helper      |
| `backend/src/services/mixService.ts`    | Add internal methods without userId    |
| `backend/src/schema/mix.graphql`        | Add internal mutations and input types |
| `backend/src/resolvers/mixResolver.ts`  | Add internal mutation resolvers        |

### Files Created

| File                                                   | Purpose                          |
| ------------------------------------------------------ | -------------------------------- |
| `services/worker/src/clients/backend.ts`               | GraphQL client for backend calls |
| `services/worker/src/schemas/backend.ts`               | Zod schemas for client I/O       |
| `backend/tests/contract/mix/internalMutations.test.ts` | Backend mutation tests           |
| `services/worker/tests/contract/backend.test.ts`       | Worker client tests              |

### API Contract

#### GraphQL Mutations (Backend)

```graphql
# Internal mutations (service auth only)
extend type Mutation {
  """
  Update mix status (service auth only)
  """
  internalUpdateMixStatus(
    mixId: ID!
    status: MixStatus!
    failureReason: String
  ): InternalMixResult!

  """
  Update mix segments (service auth only)
  """
  internalUpdateMixSegments(
    mixId: ID!
    segments: [MixSegmentInput!]!
    totalDurationMs: Int!
    characterCount: Int!
  ): InternalMixResult!
}

union InternalMixResult = Mix | MixError

input MixSegmentInput {
  id: ID!
  type: SegmentType!
  startMs: Int!
  endMs: Int!
  durationMs: Int!
  # Optional music/voice fields...
}
```

#### Worker Client Interface

```typescript
interface BackendClient {
  updateMixStatus(
    mixId: string,
    status: MixStatus,
    failureReason?: string,
  ): Promise<Mix>;

  updateMixSegments(
    mixId: string,
    segments: MixSegmentInput[],
    totalDurationMs: number,
    characterCount: number,
  ): Promise<Mix>;
}
```

## Security Considerations

1. **API Key Validation**: Internal mutations only accept service API key, never user tokens
2. **No User Context**: Internal operations bypass user ownership checks intentionally
3. **Audit Logging**: All internal operations logged with service identifier
4. **Environment Separation**: Different API keys per environment

## Testing Strategy

### Contract Tests (Backend)

- `internalUpdateMixStatus` requires service auth
- `internalUpdateMixStatus` rejects user auth (no API key)
- `internalUpdateMixStatus` updates status correctly
- `internalUpdateMixSegments` updates segments correctly
- NOT_FOUND error for invalid mixId

### Contract Tests (Worker)

- `backendClient.updateMixStatus()` sends correct GraphQL
- `backendClient.updateMixSegments()` sends correct GraphQL
- Handles errors correctly (retryable vs non-retryable)

## Dependencies

- Existing `SERVICE_API_KEY` environment variable
- Existing `BACKEND_API_URL` environment variable in worker
- Backend must be running for integration tests
