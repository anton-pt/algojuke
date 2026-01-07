# Feature Specification: Agent Tool Optimization

**Feature Branch**: `013-agent-tool-optimization`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "Optimisation of the agent tools introduced in @specs/011-agent-tools/spec.md leveraging the short description of the track's interpretation added in @specs/012-track-short-description/spec.md. Specifically, the agent should only receive the short description of the track in the library search tool (rather than the full interpretation and lyrics). If the agent needs the full interpretation of a track, it should request it via the batch metadata tool using the ISRC instead. This should be used sparingly for songs which are critical to the playlist being generated to avoid using excessive input tokens."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Efficient Semantic Search Results (Priority: P1)

As a music enthusiast chatting with the AI agent, I want semantic search results to include only a brief summary of each track so that the agent can quickly scan many results without being overwhelmed by lengthy interpretation text, reducing response times and token costs.

**Why this priority**: This is the core optimization - reducing token usage in the most frequent operation (semantic search). Without this, every search floods the agent with full interpretations and lyrics, making conversation slower and more expensive.

**Independent Test**: Can be fully tested by asking the agent to "find melancholic songs about loss" and verifying the search results contain only short descriptions (50 words or fewer per track) rather than full interpretations and lyrics.

**Acceptance Scenarios**:

1. **Given** a user asks the agent for tracks matching a mood, **When** the agent performs a semantic search, **Then** each result includes only the short description, not the full interpretation or lyrics
2. **Given** the agent receives semantic search results, **When** viewing the result payload, **Then** each track contains: title, artist, album, ISRC, short description, audio features, and library status flag
3. **Given** a track has no short description (edge case during backfill), **When** returned in search results, **Then** the short description field is null and the agent can request full metadata if needed
4. **Given** the agent receives 20 search results, **When** processing the response, **Then** the total token count for results is significantly lower than with full interpretations

---

### User Story 2 - On-Demand Full Metadata Retrieval (Priority: P1)

As an AI agent building a playlist, I need to retrieve the full interpretation and lyrics for specific tracks that are critical to my recommendations so that I can provide detailed context to users about why a track fits their request, while keeping overall token usage low.

**Why this priority**: Equally critical to the optimization - the agent must still be able to access full metadata when needed for high-value decisions. Without this, the agent loses the ability to make nuanced recommendations.

**Independent Test**: Can be fully tested by having the agent request batch metadata for 3 specific ISRCs and verifying the response includes full interpretation text and lyrics for each track.

**Acceptance Scenarios**:

1. **Given** the agent identifies a track as potentially important for a playlist, **When** it calls the batch metadata tool with the track's ISRC, **Then** it receives the full interpretation and lyrics for that track
2. **Given** the agent requests metadata for multiple ISRCs, **When** the response is returned, **Then** each found track includes: title, artist, album, ISRC, full interpretation, lyrics, and all audio features
3. **Given** the agent needs to explain why a specific track fits a user's mood, **When** it has retrieved full metadata, **Then** it can reference specific lyrical themes and interpretation details in its response
4. **Given** the agent requests metadata for tracks not in the index, **When** the response is returned, **Then** missing ISRCs are clearly indicated without error

---

### User Story 3 - Smart Metadata Fetching Strategy (Priority: P2)

As a system operator, I want the agent to use full metadata retrieval sparingly and strategically so that token costs remain low while still enabling high-quality playlist recommendations.

**Why this priority**: This ensures the optimization achieves its goal - reducing costs without sacrificing quality. Depends on the individual tools (P1 stories) being optimized first.

**Independent Test**: Can be tested by observing agent behavior across multiple playlist generation requests and verifying it typically fetches full metadata for 3-5 tracks per request rather than all search results.

**Acceptance Scenarios**:

1. **Given** the agent is building a playlist from 20 search results, **When** it decides which tracks to include, **Then** it fetches full metadata only for tracks it considers strong candidates (typically 3-5 tracks)
2. **Given** the agent can make a recommendation based on short descriptions alone, **When** responding to the user, **Then** it does not fetch full metadata unnecessarily
3. **Given** the user asks for detailed information about a specific track in a recommendation, **When** the agent responds, **Then** it fetches full metadata for that specific track only

---

### User Story 4 - Transparent Token Optimization (Priority: P3)

As a developer debugging agent behavior, I need to see in observability traces how much token usage is saved by the optimization so that I can verify the feature is working correctly and quantify cost savings.

**Why this priority**: Observability for validating the optimization is important but not blocking for the core user experience.

**Independent Test**: Can be tested by comparing traces for similar queries before and after the optimization, verifying reduced token counts in tool responses.

**Acceptance Scenarios**:

1. **Given** the agent performs a semantic search, **When** viewing observability traces, **Then** the tool response token count reflects the smaller payload (short descriptions only)
2. **Given** the agent fetches full metadata for specific tracks, **When** viewing traces, **Then** I can see which ISRCs were requested and the larger token count for full data
3. **Given** a complete playlist generation workflow, **When** reviewing the trace, **Then** I can calculate total tokens saved compared to sending full interpretations for all search results

---

### Edge Cases

- What happens when a track has no short description yet (backfill incomplete)? The search result returns null for short_description; the agent can decide whether to fetch full metadata or skip the track.
- What happens when the agent requests full metadata for an ISRC that has no interpretation? The response includes available metadata (title, artist, album, audio features) with null for interpretation and lyrics fields.
- What happens when the batch metadata limit (100 ISRCs) is reached? The system rejects the request with an error message; the agent should batch requests appropriately.
- What happens when semantic search returns no results? Empty result set is returned; agent behavior is unchanged from current implementation.
- What happens when full metadata retrieval fails for some ISRCs in a batch? Partial results are returned with found tracks; missing ISRCs are listed separately.

## Requirements *(mandatory)*

### Functional Requirements

#### Semantic Search Tool Optimization

- **FR-001**: System MUST return only the short description (not full interpretation or lyrics) for each track in semantic search results
- **FR-002**: System MUST include the following fields in semantic search results: title, artist, album, ISRC, short_description, audio features (all 11 fields), library membership flag, and relevance score
- **FR-003**: System MUST handle tracks with null short_description by returning null in the field without error
- **FR-004**: System MUST NOT include the interpretation or lyrics fields in semantic search results

#### Batch Metadata Tool Enhancement

- **FR-005**: System MUST return full interpretation and lyrics in batch metadata results when available
- **FR-006**: System MUST include all metadata fields in batch results: title, artist, album, ISRC, interpretation, lyrics, short_description, and all 11 audio features
- **FR-007**: System MUST continue to support batch requests of up to 100 ISRCs per call
- **FR-008**: System MUST clearly indicate which requested ISRCs were not found in the response

#### Agent Guidance

- **FR-009**: System documentation MUST guide the agent to use batch metadata retrieval sparingly for high-value tracks only
- **FR-010**: System MUST provide the agent with sufficient context in short descriptions to make initial filtering decisions without full metadata *(satisfied by short_description field design in feature 012)*

#### Observability

- **FR-011**: System MUST trace semantic search responses with token counts reflecting optimized payloads
- **FR-012**: System MUST trace batch metadata requests with ISRCs requested and response size

### Key Entities

- **Optimized Search Result**: A semantic search result containing abbreviated track information (short description instead of full interpretation/lyrics). Used for efficient initial filtering by the agent.
- **Full Track Metadata**: Complete track information including interpretation and lyrics. Retrieved on-demand via batch metadata tool for tracks requiring detailed analysis.
- **Short Description**: Single-sentence summary (max 50 words / ~300 characters, with 500-character schema limit) from feature 012, now the primary context field returned in search results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Semantic search result payload size is reduced by at least 70% compared to returning full interpretations and lyrics
- **SC-002**: Agent can process 20 search results and make playlist decisions within the same response time as before optimization
- **SC-003**: Agent typically fetches full metadata for no more than 5 tracks per playlist generation request
- **SC-004**: 100% of semantic search results include short descriptions for tracks that have them
- **SC-005**: Agent maintains recommendation quality (recommendations remain relevant to user requests) *(subjective measure; validated via manual testing)*
- **SC-006**: All search and metadata retrieval operations are traced with accurate payload sizes
- **SC-007**: Agent successfully builds playlists using the two-tier approach (short descriptions for scanning, full metadata for key tracks)

## Assumptions

- Short descriptions have been backfilled for existing tracks (feature 012 complete)
- The agent can effectively use short descriptions to make initial filtering decisions
- 50-word short descriptions provide sufficient context for most filtering decisions
- The batch metadata tool from feature 011 already returns full interpretation and lyrics
- Payload size savings of 70%+ are achievable given typical interpretation lengths

## Dependencies

- **specs/011-agent-tools**: Provides the semantic search and batch metadata tools being optimized
- **specs/012-track-short-description**: Provides the short_description field used in optimized search results
- **specs/009-semantic-discovery-search**: Underlying hybrid search mechanism
- **specs/004-vector-search-index**: Vector index containing track documents with short descriptions
- **specs/005-llm-observability**: Tracing for payload size monitoring

## Scope Boundaries

### In Scope

- Modifying semantic search tool to return short descriptions instead of full interpretations
- Ensuring batch metadata tool returns full interpretation and lyrics
- Updating tool response schemas for optimized payloads
- Agent prompt guidance for strategic metadata retrieval
- Observability for payload size comparison

### Out of Scope

- Modifying the short description generation logic (handled by feature 012)
- Changing the semantic search ranking algorithm
- Adding new tools beyond what exists in feature 011
- Client-side or UI changes to display optimization metrics
- Cost tracking or billing integration
- A/B testing different optimization strategies
