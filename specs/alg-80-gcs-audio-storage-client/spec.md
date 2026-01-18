# ALG-80: GCS Audio Storage Client

## Summary

A GCS (Google Cloud Storage) client service that uploads and serves voice segment audio files for the Radio Station feature. This is Ticket 6 of the Radio Station Phase 1 implementation.

**Key Architectural Decision:** Signed URLs are generated on-demand by the backend when users request playback, NOT pre-generated at upload time. This ensures mixes remain accessible indefinitely (until explicitly deleted), not just for 24 hours after generation.

**Two-Service Model:**

1. **Worker service:** Uses GCS client to upload audio during mix generation
2. **Backend service:** Uses GCS client to generate signed URLs on-demand when user requests playback

## User Scenarios

### P1 - Upload Voice Segment (Worker)

**Why:** Core functionality - without upload capability, voice segments cannot be stored for playback

- Given a valid audio buffer and path `mixes/abc123/seg001.mp3`
- When `uploadAudio(buffer, path)` is called
- Then the file is uploaded and the GCS path is returned

**Validation scenarios:**

- Given an empty buffer, When uploadAudio is called, Then an APIError with status 422 is thrown
- Given GCS service is unavailable, When uploadAudio is called, Then an APIError with status 503 and retryable=true is thrown

### P1 - Get Signed URL On-Demand (Backend)

**Why:** Core functionality - ensures mixes are accessible whenever users return to AlgoJuke

- Given an existing file path stored in Mix entity
- When user requests playback
- Then backend generates a fresh signed URL valid for 24 hours

**Validation scenarios:**

- Given an existing file path and expiryHours=1, When getSignedUrl is called, Then a signed URL valid for 1 hour is returned
- Given a non-existent file path (deleted file), When getSignedUrl is called, Then an APIError with status 404 is thrown

### P1 - Client Initialization

**Why:** Developer experience - fail fast on missing configuration

- Given valid GCS_PROJECT_ID and GCS_BUCKET_NAME env vars, When createGCSClient is called, Then a valid client instance is returned
- Given missing GCS_PROJECT_ID, When createGCSClient is called, Then an Error is thrown with clear message

## Edge Cases

1. Path contains invalid characters → Zod validation rejects with 422 error
2. Upload succeeds but signed URL generation fails → Caller handles separately (atomic operations)
3. GCS credentials are invalid at runtime → APIError with 401, retryable=false
4. Bucket doesn't exist → APIError with 404, retryable=false

## Functional Requirements

### Client Interface (Worker)

| ID     | Requirement                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | Worker GCS client MUST provide `uploadAudio(buffer: Buffer, path: string): Promise<string>` method that uploads audio to GCS and returns the GCS path |
| FR-002 | Worker GCS client MUST export a `createGCSClient(projectId?, bucketName?)` factory function                                                           |

### Client Interface (Backend)

| ID     | Requirement                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-003 | Backend GCS client MUST provide `getSignedUrl(path: string, expiryHours?: number): Promise<string>` method that returns a signed URL with configurable expiry (default 24 hours) |
| FR-004 | Backend GCS client MUST export a `createGCSClient(projectId?, bucketName?)` factory function                                                                                     |

### Configuration (Both Services)

| ID     | Requirement                                                                         |
| ------ | ----------------------------------------------------------------------------------- |
| FR-005 | Both clients MUST read `GCS_PROJECT_ID` from environment variables                  |
| FR-006 | Both clients MUST read `GCS_BUCKET_NAME` from environment variables                 |
| FR-007 | Both clients MUST throw an Error on initialization if required env vars are missing |

### Validation (Worker)

| ID     | Requirement                                                         |
| ------ | ------------------------------------------------------------------- |
| FR-008 | Worker client MUST validate that buffer is non-empty before upload  |
| FR-009 | Worker client MUST validate that path is a non-empty string         |
| FR-010 | Worker client MUST set content-type to `audio/mpeg` for all uploads |

### Error Handling (Both Services)

| ID     | Requirement                                                                       |
| ------ | --------------------------------------------------------------------------------- |
| FR-011 | Both clients MUST wrap all GCS errors in `APIError` from respective `./errors.ts` |
| FR-012 | Both clients MUST mark network/timeout errors as `retryable: true`                |
| FR-013 | Both clients MUST mark 404 (file not found) errors as `retryable: false`          |

### Testing (Both Services)

| ID     | Requirement                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------- |
| FR-014 | Both clients MUST export Zod schemas for input validation (for contract testing)                     |
| FR-015 | Both clients MUST provide a `mapGCSError(error: unknown): APIError` function for error mapping tests |

## Dependencies

**New dependency:**

- `@google-cloud/storage` - Official GCS SDK

**Existing (Worker):**

- `services/worker/src/clients/errors.ts` - APIError class and createAPIError helper
- Pattern reference: `services/worker/src/clients/elevenlabs.ts`
- Validation: `zod` v3.x

**Existing (Backend):**

- Pattern reference: `backend/src/clients/qdrantClient.ts`
- Will create: `backend/src/clients/errors.ts` (mirror worker pattern)
- Validation: `zod` v4.x

## Out of Scope

**In Scope:**

- GCS client for worker service (upload functionality)
- GCS client for backend service (signed URL generation)
- Input validation with Zod schemas in both services
- Error handling following existing patterns
- Contract tests for schemas and error mapping

**Out of Scope:**

- GCS bucket creation (infrastructure/terraform)
- Lifecycle policy configuration (handled at infrastructure level)
- Direct audio playback/streaming (handled by frontend with signed URLs)
- Audio format conversion (ElevenLabs outputs MP3 directly)
- File deletion method (explicit deletion not needed for v1)
- Shared package extraction (keep clients in respective services for simplicity)

## Implementation Details

### File Locations

- `services/worker/src/clients/gcs.ts` - Worker client (upload)
- `services/worker/tests/contract/gcs.test.ts` - Worker client tests
- `backend/src/clients/gcs.ts` - Backend client (signed URL)
- `backend/src/clients/errors.ts` - Backend APIError (new)
- `backend/tests/contract/gcs.test.ts` - Backend client tests

### Worker Client Interface

```typescript
export interface GCSClient {
  uploadAudio(buffer: Buffer, path: string): Promise<string>;
}

export function createGCSClient(
  projectId?: string,
  bucketName?: string,
): GCSClient;
```

### Backend Client Interface

```typescript
export interface GCSClient {
  getSignedUrl(path: string, expiryHours?: number): Promise<string>;
}

export function createGCSClient(
  projectId?: string,
  bucketName?: string,
): GCSClient;
```

### Zod Schemas (Worker)

```typescript
export const UploadAudioInputSchema = z.object({
  buffer: z
    .instanceof(Buffer)
    .refine((buf) => buf.length > 0, { message: "Buffer cannot be empty" }),
  path: z
    .string()
    .min(1, "Path cannot be empty")
    .regex(/^[a-zA-Z0-9\-_\/\.]+$/, "Path contains invalid characters"),
});
```

### Zod Schemas (Backend)

```typescript
export const GetSignedUrlInputSchema = z.object({
  path: z
    .string()
    .min(1, "Path cannot be empty")
    .regex(/^[a-zA-Z0-9\-_\/\.]+$/, "Path contains invalid characters"),
  expiryHours: z.number().min(1).max(168).optional().default(24),
});
```

### Error Mapping

GCS SDK errors to APIError mapping:

| GCS Error               | Status | Retryable | Notes                 |
| ----------------------- | ------ | --------- | --------------------- |
| 401 Unauthorized        | 401    | No        | Invalid credentials   |
| 403 Forbidden           | 403    | No        | Permission denied     |
| 404 Not Found           | 404    | No        | File/bucket not found |
| 408 Request Timeout     | 408    | Yes       | Network timeout       |
| 429 Too Many Requests   | 429    | Yes       | Rate limit            |
| 500 Internal Error      | 500    | Yes       | Server error          |
| 502 Bad Gateway         | 502    | Yes       | Server error          |
| 503 Service Unavailable | 503    | Yes       | Service unavailable   |
| 504 Gateway Timeout     | 504    | Yes       | Server timeout        |
| Network errors          | 503    | Yes       | Connection issues     |

### Data Flow

```
Mix Generation (Worker):
1. ElevenLabs generates audio buffer
2. Worker uploads buffer via GCS client → returns GCS path (e.g., "mixes/abc123/seg001.mp3")
3. Worker stores GCS path in Mix.segments[].audioPath (not audioUrl)

Playback Request (Backend):
1. User requests mix playback via GraphQL
2. Backend fetches Mix entity with segment paths
3. For each voice segment, backend calls GCS client.getSignedUrl(audioPath)
4. Returns signed URLs to frontend (valid 24 hours)
5. Frontend uses signed URLs for audio playback
```

## Test Plan

### Contract Tests (Worker)

Location: `services/worker/tests/contract/gcs.test.ts`

1. **Schema validation tests**
   - Valid upload input parsing
   - Empty buffer rejection
   - Empty path rejection
   - Invalid path characters rejection

2. **Error mapping tests**
   - 401 → non-retryable
   - 404 → non-retryable
   - 429 → retryable
   - 503 → retryable
   - Network errors → retryable

### Contract Tests (Backend)

Location: `backend/tests/contract/gcs.test.ts`

1. **Schema validation tests**
   - Valid signed URL input parsing
   - Empty path rejection
   - Invalid path characters rejection
   - Expiry hours validation (1-168)

2. **Error mapping tests**
   - 401 → non-retryable
   - 404 → non-retryable
   - 429 → retryable
   - 503 → retryable
   - Network errors → retryable

## Environment Variables

| Variable          | Required | Default | Description                   |
| ----------------- | -------- | ------- | ----------------------------- |
| `GCS_PROJECT_ID`  | Yes      | -       | GCP project identifier        |
| `GCS_BUCKET_NAME` | Yes      | -       | Bucket name for audio storage |

## Success Criteria

- SC-001: uploadAudio successfully stores files accessible via getSignedUrl
- SC-002: Signed URLs are valid for the specified expiry duration
- SC-003: All GCS errors are wrapped in APIError with appropriate status codes
- SC-004: Contract tests cover schema validation and error mapping
- SC-005: Client is mockable for unit testing in dependent services

## Verification

```bash
# Install dependencies
cd services/worker && npm install @google-cloud/storage
cd backend && npm install @google-cloud/storage

# Run contract tests
npm test -- tests/contract/gcs.test.ts

# Run type check
npm run type-check

# Run lint
npm run lint
```

**Note:** Integration tests that make real GCS calls require valid credentials and are out of scope for contract tests.
