# Research: Track Ingestion Pipeline

**Feature**: 006-track-ingestion-pipeline
**Date**: 2025-12-29

## External API Integration

### ReccoBeats Audio Features API

**Decision**: Use ReccoBeats `/v1/audio-features` endpoint with ISRC parameter

**Endpoint**: `GET https://api.reccobeats.com/v1/audio-features?isrc={ISRC}`

**Rationale**:
- Free API, no authentication required
- Returns all 11 audio features matching the vector index schema
- May return zero or multiple results for a single ISRC

**Response Handling**:
- Zero results: Proceed with null audio features
- Multiple results: Use first result, log warning
- Rate limit (429): Rely on Inngest step retry with exponential backoff

**Alternatives Considered**:
- Spotify Audio Features API: Requires OAuth, more complex authentication
- AcousticBrainz: Deprecated as of 2022

---

### Musixmatch Lyrics API

**Decision**: Use `track.lyrics.get` endpoint with `track_isrc` parameter

**Endpoint**: `GET https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_isrc={ISRC}&apikey={API_KEY}`

**Rationale**:
- Direct ISRC lookup avoids additional search step
- Returns lyrics body and metadata in single call
- 2000 requests/day on free tier sufficient for prototype

**Response Fields Used**:
- `lyrics_body`: Full lyric text for LLM interpretation
- `lyrics_language`: For logging/debugging
- `explicit`: Flag stored for future filtering

**Error Handling**:
- 404 Not Found: Proceed with empty lyrics, skip interpretation
- 401 Unauthorized: Fail step, check API key configuration
- Rate limit: Rely on Inngest step retry

**Alternatives Considered**:
- Genius API: More complex auth, requires scraping for full lyrics
- LyricFind: Enterprise pricing only

---

### Anthropic Claude via Vercel AI SDK

**Decision**: Use `@ai-sdk/anthropic` with `generateText` for interpretation

**Model**: `claude-sonnet-4-20250514` (Claude Sonnet 4.5)

**Rationale**:
- Vercel AI SDK provides clean TypeScript interface
- Standardized API across providers
- Built-in token counting in response

**Integration Pattern**:
```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const result = await generateText({
  model: anthropic('claude-sonnet-4-20250514'),
  prompt: interpretationPrompt,
});
```

**Prompt Storage**: In-code (`src/prompts/lyricsInterpretation.ts`) per user requirement - no Langfuse prompt management needed.

**Alternatives Considered**:
- Direct Anthropic SDK: More verbose, less standardized
- OpenAI: Different model capabilities for lyric analysis

---

### TEI Embedding Service

**Decision**: Run TEI in Docker with CPU backend

**Docker Command**:
```bash
docker run -p 8080:80 -v hf_cache:/data --pull always \
  ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2 \
  --model-id Qwen/Qwen3-Embedding-8B --dtype float16
```

**Docker Compose Configuration**:
```yaml
tei:
  image: ghcr.io/huggingface/text-embeddings-inference:cpu-1.7.2
  container_name: algojuke-tei
  command: --model-id Qwen/Qwen3-Embedding-8B --dtype float16
  ports:
    - "8080:80"
  volumes:
    - tei_cache:/data
  networks:
    - algojuke-network
```

**Model Specifications** (Qwen3-Embedding-8B):
- Embedding dimensions: 4096 (matches vector index schema)
- Context length: 32K tokens
- Instruction-aware: Yes (improves retrieval by 1-5%)

**Embedding API**:
```bash
curl http://localhost:8080/embed \
  -X POST \
  -d '{"inputs": ["text to embed"]}' \
  -H "Content-Type: application/json"
```

**Instruction Format** (for queries, not documents):
```
Instruct: Given song lyrics interpretation, create an embedding for music discovery and playlist generation
Query: {interpretation_text}
```

**Rationale**:
- CPU mode simpler than native Metal build
- ~10 vectors/minute throughput acceptable for prototype
- Docker ensures consistent environment

**Alternatives Considered**:
- Native Metal build: Better performance but complex setup, Docker GPU passthrough not supported on macOS
- Smaller model (0.6B): Faster but lower quality embeddings

---

## Langfuse Observability Integration

**Decision**: Use existing `@algojuke/observability` service

**Trace Structure**:
```
trace: track-ingestion/{isrc}
├── span: fetch-audio-features (HTTP)
├── span: fetch-lyrics (HTTP)
├── span: generate-interpretation (Generation)
├── span: embed-interpretation (HTTP)
└── span: store-document (Search)
```

**Integration Pattern**:
- Create trace at pipeline start with ISRC as identifier
- Use `createHTTPSpan` for API calls (ReccoBeats, Musixmatch, TEI)
- Use `createGenerationSpan` for LLM call (captures prompt, completion, tokens)
- Use `createSearchSpan` for Qdrant upsert

**Context Propagation**: Use `withTraceContext` from observability service to maintain trace ID across Inngest steps.

---

## LLM Prompt Design

**Decision**: Single-purpose interpretation prompt optimized for playlist generation

**Prompt Requirements**:
1. Extract thematic content (love, loss, celebration, etc.)
2. Identify emotional tone and mood
3. Describe narrative arc if present
4. Note musical/cultural context when relevant
5. Output suitable for embedding and semantic search

**Prompt Template** (draft):
```
You are analyzing song lyrics to create a rich, searchable interpretation for a music discovery system.

Given the following song information and lyrics, create a detailed interpretation that captures:
1. **Themes**: Core topics and ideas (love, rebellion, nostalgia, etc.)
2. **Emotional Tone**: The mood and feelings evoked (melancholic, euphoric, angry, etc.)
3. **Narrative**: Any story or journey in the lyrics
4. **Context**: Cultural, social, or musical context when apparent

Write a cohesive 2-3 paragraph interpretation that would help someone find this song when searching for music matching specific moods, themes, or experiences. Focus on what makes this song emotionally resonant and thematically distinctive.

Song: {title} by {artist}
Album: {album}

Lyrics:
{lyrics}
```

**Output Length**: 150-300 words (fits well within TEI 32K context)

---

## Inngest Step Design

**Decision**: 6 discrete steps for maximum memoization granularity

**Pipeline Steps**:
1. `fetch-audio-features`: ReccoBeats API call
2. `fetch-lyrics`: Musixmatch API call
3. `generate-interpretation`: LLM call (only if lyrics available)
4. `embed-interpretation`: TEI embedding call
5. `store-document`: Qdrant upsert
6. `emit-completion`: Send completion event

**Step Configuration**:
- Retries: 5 (per spec FR-005)
- Concurrency: 10 (per spec)
- Throttle: 10/minute (protects external APIs)
- Idempotency: `event.data.isrc` (prevents duplicate ingestion)

**Memoization Benefit**: Each external call is independently retryable. If embedding fails, lyrics/audio features are not re-fetched.

---

## Dependencies Summary

| Package | Version | Purpose |
|---------|---------|---------|
| `ai` | ^4.0.0 | Vercel AI SDK core |
| `@ai-sdk/anthropic` | ^1.0.0 | Anthropic provider |
| `axios` | ^1.6.0 | HTTP client for APIs |
| `inngest` | ^3.22.12 | Already installed |
| `zod` | ^3.23.8 | Already installed |

**No new infrastructure dependencies** - TEI added to existing docker-compose.yml.
