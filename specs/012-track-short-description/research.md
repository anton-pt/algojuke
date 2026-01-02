# Research: Track Short Description

**Feature**: 012-track-short-description
**Date**: 2026-01-02

## 1. Claude Haiku 4.5 for Short Description Generation

### Decision
Use `claude-haiku-4-5-20251001` via Vercel AI SDK for generating short descriptions.

### Rationale
- **Speed**: Haiku is optimized for low-latency responses, ideal for single-sentence generation
- **Cost**: Significantly cheaper than Sonnet/Opus for simple summarization tasks
- **Quality**: Sufficient for condensing existing interpretation into one sentence
- **Existing integration**: Project already uses Vercel AI SDK with `@ai-sdk/anthropic`

### Alternatives Considered
| Alternative | Rejected Because |
|------------|------------------|
| Claude Sonnet 4.5 | Overkill for single-sentence generation; higher cost and latency |
| Local LLM (Ollama) | Requires additional infrastructure; inconsistent quality |
| Template-based (no LLM) | Lacks semantic understanding; produces generic, unhelpful descriptions |

### Implementation Notes
- Use same `generateText` pattern as existing `anthropic.ts` client
- Set `maxOutputTokens: 100` to constrain output length
- Model identifier: `claude-haiku-4-5-20251001`

## 2. Prompt Design for Short Descriptions

### Decision
Create separate prompts for tracks with/without interpretation:

**With interpretation** (has lyrics):
```text
Summarize this track interpretation in exactly one sentence (max 50 words).
Focus on mood, theme, and emotional content. Output only the sentence.

Track: {title} by {artist}
Interpretation: {interpretation}
```

**Without interpretation** (instrumental):
```text
Describe this instrumental track in exactly one sentence (max 50 words).
Use the audio features and metadata to convey its sonic character. Output only the sentence.

Track: {title} by {artist} from {album}
Audio Features: {formatted_features}
```

### Rationale
- Explicit word limit in prompt constrains output
- "Output only the sentence" prevents preamble/explanation
- Different prompts handle the two distinct use cases clearly
- Audio feature formatting provides meaningful context for instrumentals

### Audio Feature Formatting
For instrumentals, format audio features as human-readable descriptors:
- `energy: 0.8` → "high energy"
- `valence: 0.2` → "melancholic mood"
- `tempo: 140` → "fast tempo (140 BPM)"
- `acousticness: 0.9` → "acoustic"
- `danceability: 0.7` → "danceable"

## 3. Backfill Script Rate Limiting

### Decision
Rate limit backfill to 1 track every 2 seconds (30 tracks/minute) using a simple delay between API calls.

### Rationale
- User explicitly requested 1 track every 2 seconds
- Simple `sleep(2000)` between iterations is reliable and predictable
- No complex rate limiting library needed for sequential processing
- Progress file enables resumption after interruption

### Implementation Approach
```typescript
for (const track of tracksToProcess) {
  await processTrack(track);
  await sleep(2000); // 1 track every 2 seconds
}
```

### Progress Tracking
Store progress in a JSON file:
```json
{
  "lastProcessedOffset": 150,
  "totalProcessed": 150,
  "errors": [],
  "startedAt": "2026-01-02T10:00:00Z",
  "lastUpdatedAt": "2026-01-02T10:05:00Z"
}
```

## 4. Qdrant Schema Extension

### Decision
Add `short_description` as an optional nullable string field to the track document schema.

### Rationale
- Optional field allows backward compatibility with existing documents
- Nullable handles cases where generation fails
- No migration needed - Qdrant handles new fields gracefully

### Implementation
```typescript
// In trackDocument.ts
short_description: z.string().nullable().optional(),
```

### Alternatives Considered
| Alternative | Rejected Because |
|------------|------------------|
| Required field | Would break existing documents |
| Separate collection | Adds complexity; data belongs with track |
| Computed at query time | Defeats purpose of pre-computation; adds latency |

## 5. Pipeline Step Placement

### Decision
Add short description step after interpretation, before store-document.

### Rationale
- Depends on interpretation text (when available)
- Must complete before document storage
- Memoized by Inngest like other steps

### Step Sequence (Updated)
1. fetch-audio-features
2. fetch-lyrics
3. generate-interpretation
4. **generate-short-description** ← NEW
5. embed-interpretation
6. store-document
7. emit-completion

## 6. Error Handling Strategy

### Decision
On short description generation failure:
- Log error with context
- Store `null` for `short_description`
- Continue with pipeline (do not fail entire ingestion)

### Rationale
- Short description is enhancement, not critical data
- Failing entire ingestion for description failure is disproportionate
- Null values can be backfilled later
- Aligns with spec FR-007

## 7. Langfuse Tracing

### Decision
Use existing `createGenerationSpan` for short description LLM calls.

### Rationale
- Consistent with interpretation tracing
- Captures model, prompt, completion, tokens
- No new observability infrastructure needed

### Span Configuration
```typescript
createGenerationSpan(trace, {
  name: "llm-short-description",
  model: "claude-haiku-4-5-20251001",
  prompt: shortDescPrompt,
  metadata: { isrc, hasInterpretation: true/false },
});
```
