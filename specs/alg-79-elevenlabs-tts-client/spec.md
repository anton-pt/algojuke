# ALG-79: ElevenLabs TTS Client

## Summary

A client service for the ElevenLabs text-to-speech API that generates MP3 audio from text input. This is Ticket 5 of the Radio Station Phase 1 implementation, enabling voice segment generation for radio mixes.

**Implementation approach:** Uses the official `@elevenlabs/elevenlabs-js` SDK (v2.31.0) instead of raw HTTP requests.

## User Scenarios

### P1 - Generate Speech from Text

**Why:** Core functionality - converting text to audio for radio mix voice segments

- Given valid text and voice ID
- When `generateSpeech(text, voiceId)` is called
- Then returns an MP3 Buffer with the synthesized audio

### P1 - Handle Rate Limits (429)

**Why:** ElevenLabs enforces concurrent request limits; must be retryable

- Given the API returns 429 (too_many_concurrent_requests)
- When the client receives this response
- Then it throws a retryable `APIError` with `retryable: true`

### P1 - Handle Authentication Errors (401)

**Why:** Invalid/missing API key should fail fast

- Given an invalid or missing API key
- When any API call is made
- Then it throws a non-retryable `APIError` with `retryable: false`

### P2 - Configure Voice Settings

**Why:** Allow customization of stability, similarity boost for voice quality

- Given optional voice settings (stability, similarityBoost)
- When `generateSpeech()` is called with settings
- Then the request includes voice settings in the body

### P2 - Handle Validation Errors (422)

**Why:** Malformed requests should provide clear error messages

- Given invalid request parameters (empty text, invalid voice ID format)
- When the API returns 422 (UnprocessableEntityError)
- Then it throws a non-retryable `APIError` with descriptive message

### P3 - System Busy (429 - system_busy)

**Why:** High traffic conditions should be retryable

- Given the API returns 429 with "system_busy" message
- When the client receives this response
- Then it throws a retryable `APIError`

## Edge Cases

1. Empty text input - throws validation error before API call
2. Very long text (>5000 characters) - throws validation error
3. Invalid voice ID format - propagates 422 error from API
4. Network timeout - SDK handles with 60s default timeout
5. SDK throws ElevenLabsTimeoutError - wrapped as retryable APIError

## Functional Requirements

| ID     | Requirement                                                                        |
| ------ | ---------------------------------------------------------------------------------- |
| FR-001 | `createElevenLabsClient(apiKey?)` factory function that validates API key presence |
| FR-002 | `generateSpeech(text, voiceId, options?)` method returning `Promise<Buffer>`       |
| FR-003 | Throw error if `ELEVENLABS_API_KEY` env var missing and no key provided            |
| FR-004 | Use `APIError` from existing `errors.ts` for all error responses                   |
| FR-005 | Map SDK errors to APIError with correct retryable flag                             |
| FR-006 | Zod schemas for input validation (before calling SDK)                              |
| FR-007 | Default output format: `mp3_44100_128`                                             |
| FR-008 | Default model: `eleven_multilingual_v2`                                            |
| FR-009 | SDK timeout: 60 seconds (default)                                                  |

## Dependencies

**New dependency:**

- `@elevenlabs/elevenlabs-js` v2.31.0 (official SDK)

**Existing:**

- Pattern reference: `services/worker/src/clients/musixmatch.ts`
- Error handling: `services/worker/src/clients/errors.ts` (`createAPIError`, `APIError`)
- Validation: `zod` v3.x (already in worker package.json)

## Out of Scope

- Streaming TTS (WebSocket endpoint)
- Voice cloning/creation
- Pronunciation dictionaries
- Request stitching (previous_text, next_text)
- Caching audio responses
- Character usage tracking
- Integration tests (expensive API calls)

## Implementation Details

### File Location

`services/worker/src/clients/elevenlabs.ts`

### Interface Design

```typescript
export interface ElevenLabsVoiceSettings {
  stability?: number; // 0-1, default 0.5
  similarityBoost?: number; // 0-1, default 0.75
  style?: number; // 0-1, default 0
  useSpeakerBoost?: boolean; // default true
}

export interface GenerateSpeechOptions {
  voiceSettings?: ElevenLabsVoiceSettings;
  modelId?: string; // default: "eleven_multilingual_v2"
  outputFormat?: string; // default: "mp3_44100_128"
}

export interface ElevenLabsClient {
  generateSpeech(
    text: string,
    voiceId: string,
    options?: GenerateSpeechOptions,
  ): Promise<Buffer>;
}

export function createElevenLabsClient(apiKey?: string): ElevenLabsClient;
```

### Zod Schemas

```typescript
export const GenerateSpeechInputSchema = z.object({
  text: z.string().min(1, "Text cannot be empty").max(5000, "Text too long"),
  voiceId: z.string().min(1, "Voice ID required"),
  voiceSettings: z
    .object({
      stability: z.number().min(0).max(1).optional(),
      similarityBoost: z.number().min(0).max(1).optional(),
      style: z.number().min(0).max(1).optional(),
      useSpeakerBoost: z.boolean().optional(),
    })
    .optional(),
  modelId: z.string().optional(),
  outputFormat: z.string().optional(),
});
```

### Error Mapping

SDK error types to APIError mapping:

| SDK Error                      | Status | Retryable | Notes                          |
| ------------------------------ | ------ | --------- | ------------------------------ |
| `UnprocessableEntityError`     | 422    | No        | Invalid params, missing fields |
| `ElevenLabsTimeoutError`       | 408    | Yes       | Request timeout                |
| `ElevenLabsError` (status 401) | 401    | No        | Invalid API key                |
| `ElevenLabsError` (status 403) | 403    | No        | Plan restriction               |
| `ElevenLabsError` (status 429) | 429    | Yes       | Rate limit                     |
| `ElevenLabsError` (status 5xx) | 5xx    | Yes       | Server error                   |
| Other errors                   | 500    | Yes       | Unknown errors                 |

## Test Plan

### Contract Tests

Location: `services/worker/tests/contract/elevenlabs.test.ts`

1. **Schema validation tests**
   - Valid input parsing
   - Empty text rejection
   - Text too long rejection
   - Voice settings range validation
   - Empty voice ID rejection

2. **Error mapping tests**
   - UnprocessableEntityError → 422 non-retryable
   - ElevenLabsTimeoutError → 408 retryable
   - ElevenLabsError with 401 → non-retryable
   - ElevenLabsError with 429 → retryable
   - ElevenLabsError with 5xx → retryable
   - Unknown errors → 500 retryable

## Environment Variables

| Variable             | Required | Default | Description        |
| -------------------- | -------- | ------- | ------------------ |
| `ELEVENLABS_API_KEY` | Yes      | -       | ElevenLabs API key |

## Verification

```bash
# Install dependency
cd services/worker && npm install @elevenlabs/elevenlabs-js

# Run contract tests
npm test -- tests/contract/elevenlabs.test.ts

# Run type check
npm run type-check

# Run lint
npm run lint
```

**Note:** Integration tests that make real API calls are out of scope (expensive API).
