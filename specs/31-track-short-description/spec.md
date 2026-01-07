# Feature Specification: Track Short Description

**Feature Branch**: `012-track-short-description`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "Create a feature to extend track ingestion pipeline to also generate a 1 sentence short description of a track based on the generated interpretation. Use claude-haiku-4-5-20251001 to generate the sentence. Create a script to backfill the short description for already-ingested tracks. The short sentence will be used in vector search results to provide an agent with sufficient context about a track to determine whether it should fetch its full metadata."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Short Description Generation During Ingestion (Priority: P1)

As a system administrator, I need tracks to have a short description automatically generated during the ingestion pipeline so that vector search results provide agents with immediate context about each track without requiring full metadata lookups.

**Why this priority**: This is the core functionality that enables agents to make informed decisions about whether to fetch full metadata. Without short descriptions, agents must either fetch all metadata (slow/expensive) or guess without context (inaccurate).

**Independent Test**: Can be fully tested by submitting a track ISRC via the Inngest payload, waiting for pipeline completion, and verifying the track document in Qdrant contains a `short_description` field with a single sentence describing the track.

**Acceptance Scenarios**:

1. **Given** a valid ISRC for a track with available lyrics and interpretation, **When** the ingestion pipeline runs to completion, **Then** the vector index contains a document with a `short_description` field containing exactly one sentence
2. **Given** a track with a generated interpretation, **When** the short description step executes, **Then** the description summarizes the track's mood, theme, and style in a single sentence of 50 words or fewer
3. **Given** the pipeline is triggered for a track with lyrics, **When** the interpretation has been generated, **Then** the short description step runs after interpretation but before final document storage

---

### User Story 2 - Backfill Existing Tracks (Priority: P1)

As a system administrator, I need a script to backfill short descriptions for tracks that were ingested before this feature was added so that all tracks in the index have consistent short descriptions available for agent queries.

**Why this priority**: Existing tracks in the index would be second-class citizens without short descriptions. Agents need uniform access to short descriptions across the entire library, not just newly ingested tracks.

**Independent Test**: Can be tested by running the backfill script against an existing Qdrant index with tracks lacking short descriptions, then querying those tracks to verify `short_description` fields are populated.

**Acceptance Scenarios**:

1. **Given** tracks exist in the index without `short_description`, **When** the backfill script runs, **Then** each track with an existing interpretation receives a generated short description
2. **Given** a track has no interpretation (instrumental), **When** the backfill script processes it, **Then** the track receives a short description based only on metadata and audio features
3. **Given** the backfill script is interrupted mid-execution, **When** restarted, **Then** it resumes from where it left off without reprocessing completed tracks
4. **Given** 1000 tracks need backfilling, **When** the script runs with default settings, **Then** all tracks are processed within a reasonable time with progress logging

---

### User Story 3 - Graceful Handling for Instrumental Tracks (Priority: P2)

As a system administrator, I need instrumental tracks (those without lyrics) to receive meaningful short descriptions so that agents can still understand what the track sounds like even without lyric-based interpretation.

**Why this priority**: Instrumental tracks are common in music libraries. They shouldn't be left with empty descriptions just because they lack lyrics.

**Independent Test**: Can be tested by ingesting an instrumental track (ISRC with no lyrics available) and verifying a short description is generated based on available metadata and audio features.

**Acceptance Scenarios**:

1. **Given** a track has no lyrics or interpretation, **When** the pipeline completes, **Then** the short description is generated using title, artist, album, and available audio features
2. **Given** an instrumental track with audio features (energy, valence, tempo), **When** generating the short description, **Then** the description reflects the track's sonic characteristics
3. **Given** an instrumental track with no audio features, **When** generating the short description, **Then** a generic description based on metadata only is created

---

### User Story 4 - Observability for Short Description Generation (Priority: P3)

As a developer debugging ingestion issues, I need the short description generation step to be traced in Langfuse so I can inspect token usage, generation times, and any failures in the description generation process.

**Why this priority**: Observability ensures visibility into costs and helps debug issues when descriptions are suboptimal or generation fails.

**Independent Test**: Can be tested by running an ingestion and verifying that Langfuse shows a generation span specifically for the short description with model identifier, prompt, completion, and token counts.

**Acceptance Scenarios**:

1. **Given** a short description is generated, **When** viewing Langfuse traces, **Then** a generation span shows the model (claude-haiku-4-5-20251001), prompt, and completion
2. **Given** the backfill script runs, **When** viewing Langfuse traces, **Then** all short description generations appear with their associated track ISRCs as metadata
3. **Given** short description generation fails, **When** viewing the trace, **Then** the error is captured with the failed prompt for debugging

---

### Edge Cases

- **Track with no interpretation and no audio features**: Generate a minimal description based solely on title, artist, and album (e.g., "A track by [Artist] from the album [Album]")
- **Very long interpretation**: The LLM naturally condenses to one sentence; no special handling needed
- **Short description generation fails**: Retry with exponential backoff per Inngest retry policy; after max retries, store null for short_description and continue (do not fail entire ingestion)
- **Duplicate backfill execution**: Script tracks processed ISRCs; already-processed tracks are skipped on re-run
- **Empty LLM response**: Validate response; if empty, retry; if consistently empty, generate fallback description from metadata
- **Non-English interpretation**: Short description is generated in English regardless of original lyric language
- **Track already has short description (re-ingestion)**: Overwrite with new description during upsert
- **Backfill encounters API rate limits**: Apply exponential backoff and respect rate limits; progress resumes after cooldown

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a short description (single sentence, max 50 words) for each track during the ingestion pipeline
- **FR-002**: System MUST use claude-haiku-4-5-20251001 model for generating short descriptions
- **FR-003**: System MUST generate the short description after the interpretation step completes (when lyrics are available)
- **FR-004**: System MUST generate a short description for instrumental tracks using metadata and audio features when no interpretation exists
- **FR-005**: System MUST store the short description in the track document's `short_description` field in Qdrant
- **FR-006**: System MUST use Inngest step functions to persist the short description result durably (memoization)
- **FR-007**: System MUST NOT fail the entire ingestion pipeline if short description generation fails; store null and continue
- **FR-008**: System MUST provide a backfill script that processes all existing tracks lacking short descriptions
- **FR-009**: Backfill script MUST track progress to enable resumption after interruption
- **FR-010**: Backfill script MUST process tracks using Qdrant scroll pagination (default batch size: 100 tracks per scroll)
- **FR-011**: Backfill script MUST enforce a 2-second delay between API calls to respect rate limits
- **FR-012**: Backfill script MUST log progress (processed count, errors, estimated time remaining)
- **FR-013**: System MUST record short description generation spans in Langfuse with model, prompt, completion, and token usage
- **FR-014**: Short descriptions MUST be in English regardless of the original lyric language
- **FR-015**: System MUST handle tracks with existing short descriptions by updating (upserting) during re-ingestion

### Key Entities

- **Short Description**: A single-sentence summary (max 50 words) describing a track's mood, theme, and style. Generated by claude-haiku-4-5-20251001 based on the full interpretation (if available) or metadata/audio features (for instrumentals).
- **Track Document** (extended): Existing track document schema extended with optional `short_description` field (string, nullable)
- **Backfill State**: Tracks processing progress including last processed ISRC, completion status, and error counts for resumable execution

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly ingested tracks with lyrics have a short description generated within the pipeline execution time
- **SC-002**: Short descriptions are exactly one sentence with 50 words or fewer in 100% of generated descriptions
- **SC-003**: Backfill script processes existing tracks at a rate of 30 tracks per minute (1 track every 2 seconds to respect API rate limits)
- **SC-004**: Backfill script successfully resumes after interruption without reprocessing completed tracks
- **SC-005**: Short description generation adds no more than 2 seconds to the overall ingestion pipeline time per track
- **SC-006**: All short description generations are traced in Langfuse with accurate token counts
- **SC-007**: Instrumental tracks receive meaningful short descriptions based on available metadata and audio features
- **SC-008**: Agents can use short descriptions from vector search results to make informed metadata fetch decisions without additional lookups

## Assumptions

- The track ingestion pipeline from specs/006-track-ingestion-pipeline is operational and processing tracks
- The Qdrant vector index from specs/004-vector-search-index can accommodate an additional string field
- Anthropic API key is available with access to claude-haiku-4-5-20251001 model
- The Langfuse observability stack from specs/005-llm-observability is running
- claude-haiku-4-5-20251001 can reliably produce single-sentence summaries from interpretation text
- The cost of claude-haiku-4-5-20251001 per track is acceptable for both ingestion and backfill operations
- Backfill operations can run during low-traffic periods if rate limits are a concern
- Track documents in Qdrant can be updated (upserted) with the new field without full re-indexing

## Dependencies

- **specs/006-track-ingestion-pipeline**: Existing ingestion pipeline where short description step will be added
- **specs/004-vector-search-index**: Qdrant index schema requiring field extension
- **specs/005-llm-observability**: Langfuse tracing for generation spans
- **specs/003-background-task-queue**: Inngest infrastructure for durable step execution
- **External: Anthropic API**: claude-haiku-4-5-20251001 for short description generation

## Scope Boundaries

### In Scope

- Adding short description generation step to track ingestion pipeline
- Extending track document schema with `short_description` field
- Backfill script for existing tracks
- Langfuse tracing for short description generation
- Fallback handling for instrumental tracks
- Progress tracking for backfill resumption
- Error handling and retry policies

### Out of Scope

- Modifying vector search logic (search continues using interpretation_embedding)
- Quality scoring or ranking of generated descriptions
- User-facing display of short descriptions (consumed only by agents)
- Multi-language short descriptions (always English)
- Regeneration UI for manual correction of poor descriptions
- Alternative LLM providers or fallback models
- A/B testing of description prompts or styles
