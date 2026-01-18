# ALG-85: Inngest mixGeneration Function (DJ Agent)

## Summary

Background worker function that orchestrates mix generation using an agentic approach. This is Ticket 7 of the Radio Station Phase 1 implementation - the core pipeline that fetches articles, discovers music via LLM agent, generates voice segments, and assembles the final mix.

## Dependencies

- **ALG-77**: Expose Agent Tools via GraphQL API (semanticSearch, tidalSearch, batchMetadata)
- **ALG-79**: ElevenLabs TTS Client
- **ALG-80**: GCS Audio Storage Client
- **ALG-84**: API Key Auth for Service-to-Service Communication

## Architecture

### Two-Phase Agent Design

The mix composition uses a **two-phase approach** to work around Anthropic SDK limitations with structured output:

1. **Discovery Phase**: Claude uses tools (semanticSearch, tidalSearch, batchMetadata) to find music matching article themes
2. **Composition Phase**: Claude uses the `finalizeMixPlan` tool to output the structured mix plan with voice scripts and music selections

This separation ensures reliable structured output while allowing flexible tool-based music discovery.

### Tool Access via Backend GraphQL

Tools are accessed via the backend GraphQL API (not directly in worker) to:

- Avoid zod version conflicts (worker uses zod v3 for Inngest compatibility)
- Keep tool implementations with their dependencies (Tidal client, Qdrant, etc.)
- Reuse existing agent tool infrastructure from ALG-77

## User Stories

### US-1: Mix Generation Pipeline (P1)

**As** the backend service
**I want** to trigger mix generation via Inngest event
**So that** mixes are generated asynchronously with retry support

**Acceptance Criteria:**

- Event `mix/generation.requested` triggers the pipeline
- Pipeline validates input (mixId, userId, articles array)
- At least 1 article required, maximum 10
- Each article must have documentId and contentMode

### US-2: Article Content Fetching (P1)

**As** the mix generation pipeline
**I want** to fetch article content from Readwise
**So that** I have source material for voice scripts

**Acceptance Criteria:**

- Fetch each article via `agentReadwiseFetch` GraphQL query
- Support contentMode: summary, excerpt, or full
- Continue with partial results if some articles fail
- Fail entirely only if all articles fail to fetch

### US-3: Music Discovery (P1)

**As** the DJ agent
**I want** to search for music matching article themes
**So that** I can select appropriate tracks for the mix

**Acceptance Criteria:**

- Use `semanticSearch` for mood/theme-based discovery from indexed library
- Use `tidalSearch` for specific artist/album searches
- Use `batchMetadata` to get detailed track information
- Collect discovered tracks for composition phase
- Allow up to 10 tool call steps for thorough discovery

### US-4: Mix Composition (P1)

**As** the DJ agent
**I want** to create a structured mix plan
**So that** voice scripts and music selections are properly interleaved

**Acceptance Criteria:**

- Generate voice scripts with SSML annotations for ElevenLabs
- Include opening, article introductions, and closing segments
- Select music from discovered tracks with selection reasoning
- Output via `finalizeMixPlan` tool for guaranteed structure
- Include source article references (documentId, title, url) for voice segments

### US-5: Voice Segment Generation (P1)

**As** the mix generation pipeline
**I want** to generate voice audio from scripts
**So that** I have audio files for the final mix

**Acceptance Criteria:**

- Generate TTS via ElevenLabs with DJ voice settings
- Upload audio to GCS at path `mixes/{mixId}/voice/{segmentId}.mp3`
- Parse MP3 duration for accurate timeline assembly
- Process in batches of 3 for rate limiting
- Continue with partial results if <50% fail
- Fail entirely if >50% of voice segments fail

### US-6: Mix Assembly (P1)

**As** the mix generation pipeline
**I want** to assemble the final mix with timeline positions
**So that** the frontend can render the playback timeline

**Acceptance Criteria:**

- Calculate start/end times for each segment
- Track total duration and character count
- Convert to backend MixSegmentInput format
- Save via `internalUpdateMixSegments` mutation
- Update status to READY via `internalUpdateMixStatus`

### US-7: Completion Event (P1)

**As** the mix generation pipeline
**I want** to emit a completion event
**So that** downstream systems can react to mix readiness

**Acceptance Criteria:**

- Emit `mix/generation.completed` event on success
- Include mixId, userId, runId, duration, segment counts
- Flush Langfuse traces before completion

## Technical Design

### Inngest Function Configuration

```typescript
{
  id: "mix-generation",
  retries: 3,
  concurrency: { limit: 3 },
  throttle: { limit: 5, period: "1m" },
  idempotency: "event.data.mixId"
}
```

### Pipeline Steps

| Step | Name                    | Description                              |
| ---- | ----------------------- | ---------------------------------------- |
| 1    | validate-input          | Validate event data and article count    |
| 2    | fetch-article-content   | Fetch articles from Readwise via backend |
| 3    | compose-mix             | Two-phase agent: discovery + composition |
| 4    | generate-voice-segments | TTS generation with GCS upload           |
| 5    | assemble-mix            | Calculate timeline positions             |
| 6    | save-mix                | Update backend via GraphQL               |
| 7    | emit-completion         | Send completion event                    |

### Event Schema

```typescript
// mix/generation.requested
{
  mixId: string;        // UUID
  userId: string;
  title: string;
  articles: Array<{
    documentId: string;
    contentMode: "summary" | "excerpt" | "full";
  }>;
  musicInstructions?: string;  // Optional user guidance
  description?: string;
  conversationId?: string;
  priority?: number;
}

// mix/generation.completed
{
  mixId: string;
  userId: string;
  runId: string;
  completedAt: number;
  durationMs: number;
  result: {
    segmentCount: number;
    voiceSegmentCount: number;
    musicSegmentCount: number;
    totalDurationMs: number;
    characterCount: number;
  };
}
```

### Mix Plan Schema

```typescript
interface MixPlan {
  mixId: string;
  title: string;
  theme?: string;
  segments: Array<VoicePlanSegment | MusicPlanSegment>;
  articleCount: number;
  estimatedTotalDurationMs: number;
}

interface VoicePlanSegment {
  type: "voice";
  id: string;
  order: number;
  script: {
    text: string; // With SSML annotations
    characterCount: number;
    sourceArticle: {
      documentId: string;
      title: string;
      url: string;
    } | null;
  };
}

interface MusicPlanSegment {
  type: "music";
  id: string;
  order: number;
  track: {
    isrc: string;
    tidalTrackId?: string;
    title: string;
    artist: string;
    album?: string;
    albumArtUrl?: string;
    durationMs: number;
    selectionReason?: string;
  };
  playDurationMs: number;
  fadeIn: boolean;
  fadeOut: boolean;
}
```

### DJ Voice Settings

```typescript
const DJ_VOICE_SETTINGS = {
  stability: 0.45, // Lower for more emotional range
  similarityBoost: 0.75, // High for voice consistency
  style: 0.3, // Moderate expressiveness
  useSpeakerBoost: true, // Clarity and presence
};

const DEFAULT_DJ_VOICE_ID = "TxGEqnHWrfWFTfGW9XjX"; // "Josh"
```

### SSML Voice Script Format

```
Welcome back, music lovers!
<break time="0.8s" />
THIS next article... it's INCREDIBLE.
<break time="0.5s" />
We're diving into the world of creative breakthroughs.
```

- `<break time="x.xs" />` for pauses (0.3s to 2.0s)
- ALL CAPS for emphasis
- Punctuation for natural pacing

## File Structure

```
services/worker/src/
├── inngest/
│   ├── events.ts                    # Event schemas (modified)
│   └── functions/
│       ├── index.ts                 # Function registry (modified)
│       └── mixGeneration.ts         # Main pipeline function
├── prompts/
│   └── djAgentPrompt.ts             # Discovery + Composition prompts
├── schemas/
│   ├── backend.ts                   # Agent tool response schemas (modified)
│   └── mixGeneration.ts             # Mix plan and segment schemas
├── clients/
│   └── backend.ts                   # Agent tool methods (modified)
└── observability/
    └── langfuse.ts                  # Mix generation trace (modified)
```

## Observability

- Trace ID: `mix-generation-{mixId}-{runId}`
- Tags: `mix-generation`, `dj-agent`, `pipeline`
- HTTP spans for Readwise fetch and ElevenLabs TTS
- Generation spans for discovery and composition phases
- Tracks input/output tokens for cost monitoring

## Error Handling

| Error Case                         | Behavior                       |
| ---------------------------------- | ------------------------------ |
| All articles fail to fetch         | Fail pipeline                  |
| Some articles fail                 | Continue with partial results  |
| No tracks discovered               | Fail pipeline                  |
| Agent doesn't call finalizeMixPlan | Fail pipeline                  |
| >50% TTS failures                  | Fail pipeline                  |
| ≤50% TTS failures                  | Continue, skip failed segments |
| Backend update fails               | Retry via Inngest              |

## Testing

Contract tests in `services/worker/tests/functions/mixGeneration.test.ts`:

- Event schema validation
- Mix plan schema validation
- Voice script schema validation
- Music track schema validation
- DJ voice settings validation
- Prompt generation tests (discovery + composition phases)
