# Feature Specification: Track Ingestion Pipeline

**Feature Branch**: `006-track-ingestion-pipeline`
**Created**: 2025-12-29
**Status**: Draft
**Input**: User description: "A music track ingestion pipeline which runs on the Inngest-based background task execution infrastructure set up in specs/003-background-task-queue/spec.md, receives the ISRC of the track to be ingested via the Inngest payload, populates the vector search index created in specs/004-vector-search-index/spec.md with audio features from ReccoBeats API, lyrics from Musixmatch API, LLM-generated interpretation summaries from Claude Sonnet 4.5, and embeddings from locally hosted Qwen3-Embedding-8B using TEI. Records ingestion traces in Langfuse per specs/005-llm-observability/spec.md."

## Clarifications

### Session 2025-12-29

- Q: Where should track metadata (title, artist, album) come from? → A: Input payload - metadata is passed alongside ISRC when triggering ingestion, sourced from Tidal API at search time. This ensures tracks not indexed by Musixmatch can still be fully stored.
- Q: What should happen when lyrics are exceptionally long? → A: No explicit truncation needed - LLM summarizes naturally, and Qwen3-Embedding-8B supports 32K token input which accommodates any reasonable interpretation length.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete Track Ingestion (Priority: P1)

As a system administrator, I need to ingest a music track by its ISRC so that the track becomes searchable in the vector index with comprehensive metadata including audio features, lyrics, and semantic interpretation.

**Why this priority**: This is the core pipeline that transforms raw track identifiers into fully searchable, semantically-enriched documents. Without this working end-to-end, no tracks can be added to the search index.

**Independent Test**: Can be fully tested by submitting a track ISRC via the Inngest payload, waiting for pipeline completion, and verifying the track document exists in Qdrant with all expected fields populated.

**Acceptance Scenarios**:

1. **Given** a valid ISRC for a track with available lyrics, **When** the ingestion pipeline runs to completion, **Then** the vector index contains a document with title, artist, album, ISRC, lyrics, interpretation, interpretation_embedding, and all available audio features
2. **Given** the pipeline is triggered for a track, **When** the ReccoBeats API returns audio features, **Then** all 11 audio feature fields (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence) are stored if available
3. **Given** the pipeline completes successfully, **When** querying the index by ISRC, **Then** the document's interpretation_embedding has exactly 4096 dimensions

---

### User Story 2 - Durable Execution with Step Memoization (Priority: P1)

As a developer, I need the pipeline to durably persist intermediate results after each step so that if any downstream step fails, the pipeline can retry without re-executing expensive API calls or LLM invocations.

**Why this priority**: External APIs have rate limits and costs. Re-fetching lyrics, regenerating interpretations, or re-embedding on every retry would quickly exhaust quotas and increase costs. Step memoization is critical for reliability.

**Independent Test**: Can be tested by triggering ingestion, artificially failing the embedding step after lyrics and interpretation complete, observing that retry resumes from embedding without re-calling Musixmatch or Anthropic APIs.

**Acceptance Scenarios**:

1. **Given** the pipeline has completed the lyrics fetch step, **When** the interpretation step fails and retries, **Then** the lyrics fetch step is not re-executed (memoized result is used)
2. **Given** the pipeline has completed LLM interpretation, **When** the embedding step fails and retries, **Then** the interpretation step is not re-executed
3. **Given** the worker service restarts mid-pipeline, **When** processing resumes, **Then** all previously completed steps are skipped using their memoized outputs

---

### User Story 3 - Graceful Handling of Missing Data (Priority: P2)

As a system administrator, I need the pipeline to handle tracks with missing lyrics (instrumentals) or unavailable audio features so that partial data still gets indexed rather than failing the entire ingestion.

**Why this priority**: Not all tracks have lyrics (instrumentals) or audio features in ReccoBeats. The system should maximize data capture rather than reject tracks with incomplete external data.

**Independent Test**: Can be tested by ingesting an instrumental track ISRC and verifying the document is created with null/empty lyrics but valid audio features and metadata.

**Acceptance Scenarios**:

1. **Given** a track has no lyrics available (instrumental), **When** the pipeline completes, **Then** the document is indexed with empty lyrics, no interpretation, and a zero vector embedding
2. **Given** the ReccoBeats API returns no audio features for an ISRC, **When** the pipeline completes, **Then** the document is indexed with null audio feature fields but all other data present
3. **Given** the ReccoBeats API returns multiple results for an ISRC, **When** processing the response, **Then** only the first result is used for audio features

---

### User Story 4 - Observability and Trace Correlation (Priority: P2)

As a developer debugging pipeline issues, I need all external API calls, LLM invocations, and vector operations to be traced in Langfuse so I can inspect the full execution flow, identify failures, and analyze costs.

**Why this priority**: Without observability, debugging failed ingestions, tracking token usage, and understanding latency bottlenecks would be extremely difficult.

**Independent Test**: Can be tested by running an ingestion and verifying that Langfuse shows correlated traces with spans for: HTTP calls to ReccoBeats and Musixmatch, LLM generation for interpretation, and vector search/upsert operations.

**Acceptance Scenarios**:

1. **Given** a track ingestion completes, **When** viewing Langfuse traces, **Then** all pipeline steps appear as correlated spans under a single trace ID
2. **Given** an LLM interpretation is generated, **When** viewing the generation span, **Then** prompt text, completion text, model identifier, and token counts are visible
3. **Given** external API calls are made, **When** viewing HTTP spans, **Then** endpoint URLs, response status codes, and latencies are captured

---

### User Story 5 - Rate Limiting for External APIs (Priority: P3)

As a system administrator running batch ingestions, I need the pipeline to respect rate limits for external APIs so that bulk operations don't exhaust API quotas or trigger blocking.

**Why this priority**: Rate limiting protects against quota exhaustion and API bans. While less critical for single-track ingestion, it becomes essential for batch processing.

**Independent Test**: Can be tested by configuring a throttle limit (e.g., 10 tasks/minute), queueing 30 ingestion tasks, and observing via Inngest dashboard that execution rate stays within configured limits.

**Acceptance Scenarios**:

1. **Given** a throttle limit is configured for the ingestion function, **When** many tasks are queued simultaneously, **Then** execution rate respects the configured limit
2. **Given** the ReccoBeats API returns a 429 rate limit response, **When** the step retries, **Then** exponential backoff is applied before the next attempt
3. **Given** the Musixmatch API returns a rate limit error, **When** the step retries, **Then** the retry respects the Retry-After header if provided

---

### Edge Cases

- **Missing external data (lyrics or audio features)**: Pipeline proceeds with available data; missing lyrics result in no interpretation and zero vector embedding, missing audio features result in null feature fields. Document is always indexed with whatever data is available.
- **ReccoBeats returns multiple results for single ISRC**: Use the first result; log a warning for debugging
- **LLM interpretation times out**: Retry with exponential backoff per Inngest retry policy; after max retries, mark pipeline as failed
- **Embedding service unavailable**: Retry with exponential backoff; after max retries, mark pipeline as failed (embedding is required for vector search)
- **Track already exists in index (duplicate ISRC)**: Update existing document with fresh data (upsert behavior per FR-011 from vector-search-index spec)
- **Lyrics contain special characters or multiple languages**: UTF-8 encoding handles international text; LLM processes multilingual content appropriately
- **Very long lyrics**: No truncation required - Claude summarizes naturally producing manageable interpretations, and Qwen3-Embedding-8B supports 32K token input
- **Worker restarts during LLM call**: Inngest handles durable execution; step retries from last successful checkpoint
- **Empty interpretation from LLM (malformed response)**: Validate response; if empty, retry step; if consistently empty, fail pipeline with descriptive error
- **Embedding returns wrong dimension count**: Validate embedding dimensions (must be 4096); if invalid, retry; if consistently wrong, fail with configuration error

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept track ingestion requests via Inngest events containing an ISRC identifier and track metadata (title, artist, album)
- **FR-002**: System MUST retrieve audio features from the ReccoBeats API (`/v1/audio-features`) using the track's ISRC
- **FR-003**: System MUST handle ReccoBeats API returning zero results by proceeding with null audio features
- **FR-004**: System MUST handle ReccoBeats API returning multiple results by using only the first result
- **FR-005**: System MUST retrieve track lyrics from the Musixmatch API using the track's ISRC
- **FR-006**: System MUST handle Musixmatch returning no lyrics by proceeding with empty lyrics and skipping interpretation
- **FR-007**: System MUST generate a natural language interpretation of lyric themes using Claude Sonnet 4.5 via the Anthropic API
- **FR-008**: System MUST skip interpretation generation and use a zero vector embedding when lyrics are unavailable
- **FR-009**: System MUST generate a 4096-dimensional embedding of the interpretation using locally-hosted Qwen3-Embedding-8B via TEI
- **FR-010**: System MUST store the ingested track document in the Qdrant vector index with all available fields (title, artist, album, ISRC, lyrics, interpretation, interpretation_embedding, and audio features)
- **FR-011**: System MUST use Inngest step functions to persist intermediate results (audio features, lyrics, interpretation, embedding) durably between steps
- **FR-012**: System MUST NOT re-execute completed steps on retry; memoized results from previous successful steps must be reused
- **FR-013**: System MUST apply exponential backoff retry policy for transient failures in external API calls
- **FR-014**: System MUST record all pipeline operations as traces in Langfuse with correlated span IDs
- **FR-015**: System MUST capture LLM generation details in Langfuse including prompt, completion, model, and token usage
- **FR-016**: System MUST capture external HTTP calls in Langfuse including endpoint, status code, and latency
- **FR-017**: System MUST support configurable throttle limits to control ingestion rate and respect external API quotas
- **FR-018**: System MUST validate that generated embeddings have exactly 4096 dimensions before storing
- **FR-019**: System MUST handle tracks already existing in the index by updating (upserting) the document
- **FR-020**: System MUST use track metadata (title, artist, album) from the input payload for populating the index document

### Key Entities

- **Track Ingestion Event**: The Inngest event triggering pipeline execution, containing ISRC (unique track identifier), track metadata (title, artist, album), optional priority modifier, and optional force flag to override deduplication
- **Audio Features**: Numeric properties from ReccoBeats API (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence) - all optional
- **Lyrics Content**: Plain text lyrics retrieved from Musixmatch API - optional for instrumental tracks
- **Interpretation**: Natural language summary of lyric themes generated by Claude Sonnet 4.5, describing mood, topics, and emotional content
- **Interpretation Embedding**: 4096-dimensional dense vector representation of the interpretation for semantic search
- **Track Document**: The complete indexed entity stored in Qdrant, containing all of the above plus core metadata (title, artist, album, ISRC)
- **Pipeline Trace**: Langfuse trace containing correlated spans for all pipeline operations, enabling end-to-end debugging

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tracks with complete data (lyrics + audio features available) are fully ingested within 60 seconds end-to-end (measured from Inngest event received to Qdrant upsert confirmed)
- **SC-002**: Step memoization prevents duplicate API calls: restarted pipelines complete using cached intermediate results with zero repeated external requests for completed steps
- **SC-003**: Tracks with partial data (missing lyrics or audio features) are indexed with available data; partial ingestion success rate equals 100% for valid ISRCs
- **SC-004**: All pipeline executions appear in Langfuse with full trace correlation; each trace contains spans for all executed steps with accurate timing and status
- **SC-005**: LLM interpretation tokens are tracked in Langfuse with accuracy matching Anthropic's reported usage
- **SC-006**: Throttle configuration effectively limits ingestion rate: queuing 30 tasks with a 10/minute limit results in completion spread over approximately 3 minutes
- **SC-007**: Generated embeddings have exactly 4096 dimensions in 100% of successful ingestions
- **SC-008**: Pipeline handles 429 rate limit responses gracefully: automatic retry with backoff completes successfully without manual intervention
- **SC-009**: The embedding service (TEI with Qwen3-Embedding-8B) runs on the local machine utilizing available CPU resources efficiently

## Assumptions

- The Inngest infrastructure from specs/003-background-task-queue is operational and properly configured
- The Qdrant vector index from specs/004-vector-search-index is initialized with the track document schema
- The Langfuse observability stack from specs/005-llm-observability is running and accessible
- ReccoBeats API is freely available and does not require authentication (based on current documentation)
- Musixmatch API key is available for authentication; usage falls within API terms of service
- Anthropic API key is available for Claude Sonnet 4.5 access
- TEI (Text Embeddings Inference) will run in Docker (CPU mode) via docker-compose.yml for simpler deployment and reproducibility
- Qwen3-Embedding-8B model produces 4096-dimensional embeddings with 32K token input capacity (per specs/004-vector-search-index assumptions)
- Track metadata (title, artist, album) is provided in the ingestion event payload, sourced from Tidal API at the time of track discovery/search
- Pipeline execution follows Inngest retry policy: 5 attempts with exponential backoff over 24 hours (per specs/003-background-task-queue)
- UTF-8 encoding is used for all text content to support international lyrics
- The LLM interpretation prompt will focus on extracting themes, mood, and emotional content suitable for semantic search

## Dependencies

- **specs/003-background-task-queue**: Inngest infrastructure for durable execution, step memoization, and retry policies
- **specs/004-vector-search-index**: Qdrant index schema and document storage
- **specs/005-llm-observability**: Langfuse tracing for LLM calls, HTTP spans, and trace correlation
- **External: ReccoBeats API**: Audio features retrieval (https://reccobeats.com/docs/apis/get-audio-features)
- **External: Musixmatch API**: Lyrics retrieval (requires API key)
- **External: Anthropic API**: Claude Sonnet 4.5 for interpretation generation (requires API key)
- **Local: TEI with Qwen3-Embedding-8B**: Embedding generation (runs natively on macOS with Metal support)

## Scope Boundaries

### In Scope

- Inngest function definition for track ingestion pipeline
- Integration with ReccoBeats API for audio features
- Integration with Musixmatch API for lyrics
- Integration with Anthropic API for LLM interpretation
- Integration with locally-hosted TEI for embeddings
- Storage of complete track documents in Qdrant
- Durable step execution with intermediate result persistence
- Langfuse trace instrumentation for all operations
- Rate limiting configuration for external APIs
- Error handling for missing data scenarios
- Retry policies with exponential backoff

### Out of Scope

- Batch ingestion triggering (pipeline handles single tracks; batch orchestration is separate)
- Automatic track discovery or library scanning (ingestion is triggered externally via ISRC)
- Musixmatch subscription management or quota monitoring
- TEI server deployment automation (assumed to be running locally)
- Alternative embedding models or fallback providers
- Lyrics caching beyond Inngest step memoization
- User-facing API for triggering ingestion (admin/developer triggers via Inngest)
- Quality scoring or ranking of interpretations
- Multi-language interpretation (interpretation is in English regardless of lyrics language)

## Implementation Notes

### Embedding Model Change

**Deviation from spec**: The implementation uses `mixedbread-ai/mxbai-embed-large-v1` (1024 dimensions) instead of the originally specified `Qwen3-Embedding-8B` (4096 dimensions).

**Rationale**:
- mxbai-embed-large-v1 has better availability in TEI's pre-built Docker images
- The model produces high-quality embeddings suitable for semantic search
- 1024 dimensions provides a good balance of quality and storage efficiency

**Impact**:
- Vector index schema updated to 1024 dimensions (see `services/search-index/src/schema/trackCollection.ts`)
- Zero vector for instrumentals is 1024 dimensions
- All dimension validation uses 1024 as the expected value

This change was made during implementation and the vector search index was updated accordingly. The semantic search quality remains high for music discovery use cases.
