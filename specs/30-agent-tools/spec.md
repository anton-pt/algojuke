# Feature Specification: Agent Tools for Discover Chat

**Feature Branch**: `011-agent-tools`
**Created**: 2025-12-31
**Status**: Draft
**Input**: User description: "Agent tools for the agentic chat feature introduced in @specs/010-discover-chat/spec.md: Semantic library search based on the semantic search feature introduced in @specs/009-semantic-discovery-search/spec.md allowing the agent to find tracks which have been ingested by the ingestion pipeline and are stored in the vector index. Music search based on the Tidal API search introduced in @specs/001-tidal-search/spec.md allowing the agent to look for tracks that are present in the Tidal catalogue. Track metadata retrieval for multiple tracks by ISRC. These tools aim to allow the agent to generate playlists which fit the user's mood and leverage the extensive catalogue and metadata about song interpretations, and allow the user to discover new music while listening to it in the context of familiar tracks."

## Clarifications

### Session 2025-12-31

- Q: When a tool invocation times out or fails, should the agent automatically retry before reporting failure? → A: Retry once automatically (with brief delay), then report failure if still failing
- Q: How verbose should tool invocation result summaries be in the UI? → A: Concise summary with result count and query snippet, but expandable so users can click to see full results

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Semantic Music Discovery via Chat (Priority: P1)

As a music enthusiast chatting with the AI assistant, I want to ask for music that fits a particular mood or theme and have the agent search my ingested tracks to find matches, so that I can discover relevant music from my indexed collection through natural conversation.

**Why this priority**: This is the primary value proposition - enabling the AI agent to search semantically through indexed music. Without semantic search capability, the agent cannot fulfill mood-based or thematic music requests, which is the core use case for the chat feature.

**Independent Test**: Can be fully tested by asking the agent "Find me some melancholic songs about lost love" in the chat interface and verifying the agent returns matching tracks from the vector index with full metadata including library status.

**Acceptance Scenarios**:

1. **Given** I am in a chat conversation with the AI agent, **When** I ask for "uplifting songs about new beginnings", **Then** the agent uses semantic search to find matching tracks from the vector index and presents them with their metadata
2. **Given** the agent returns semantic search results, **When** I view a track in the results, **Then** I see all available metadata (title, artist, album, lyrics, interpretation, audio features) and whether the track is in my library
3. **Given** no tracks match my semantic query, **When** the agent completes the search, **Then** it informs me that no matching tracks were found in the indexed collection
4. **Given** I ask for tracks with complex emotional descriptions, **When** the agent searches, **Then** it leverages the interpretation embeddings to find thematically appropriate matches
5. **Given** the agent returns multiple matching tracks, **When** I review the results, **Then** they are ranked by relevance to my query

---

### User Story 2 - Catalogue Exploration via Chat (Priority: P1)

As a music enthusiast looking to discover new music, I want to ask the agent to search the Tidal catalogue for specific artists, albums, or tracks, so that I can explore music beyond my indexed collection and find new content to listen to.

**Why this priority**: Equally critical to semantic search - users need to discover new music not yet in their collection. This enables the playlist generation use case by allowing the agent to mix familiar (library) tracks with new discoveries (Tidal catalogue).

**Independent Test**: Can be fully tested by asking the agent "Find albums by Radiohead" and verifying the agent returns Tidal catalogue results with library and indexing status flags.

**Acceptance Scenarios**:

1. **Given** I am chatting with the AI agent, **When** I ask "What albums does Radiohead have?", **Then** the agent searches the Tidal catalogue and returns matching albums with their artwork and metadata
2. **Given** the agent returns Tidal search results, **When** I view an album, **Then** I see whether it is in my library and can see its track listing
3. **Given** the agent returns track results from Tidal, **When** I view a track, **Then** I see whether it is in my library and whether it has been ingested into the vector index
4. **Given** I ask for tracks by a specific artist, **When** the agent returns results, **Then** each track shows flags indicating library membership and ingestion status
5. **Given** the Tidal search returns no results, **When** the agent completes the search, **Then** it informs me that no matching content was found in the Tidal catalogue
6. **Given** I ask to explore an album's tracks, **When** the agent retrieves the album details, **Then** I can see all tracks on the album with their individual library and ingestion status

---

### User Story 3 - Batch Track Metadata Retrieval (Priority: P2)

As an AI agent building a playlist for the user, I need to retrieve detailed metadata for multiple tracks at once by their ISRCs, so that I can efficiently gather information about tracks I'm considering for playlist recommendations.

**Why this priority**: Supports the playlist generation workflow by enabling efficient batch lookups. While individual track lookup is possible through other tools, batch retrieval is essential for the agent to efficiently evaluate multiple candidate tracks when crafting playlists.

**Independent Test**: Can be fully tested by the agent requesting metadata for 5 specific ISRCs and receiving complete metadata for all indexed tracks in a single operation.

**Acceptance Scenarios**:

1. **Given** the agent needs metadata for multiple tracks, **When** it requests metadata by providing a list of ISRCs, **Then** it receives complete metadata for all tracks that exist in the vector index
2. **Given** some requested ISRCs are not in the vector index, **When** the agent receives results, **Then** only the found tracks are returned with a clear indication of which ISRCs were not found
3. **Given** the agent requests metadata for indexed tracks, **When** results are returned, **Then** each track includes all available fields: title, artist, album, ISRC, lyrics, interpretation, audio features (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence)
4. **Given** the agent requests an empty list of ISRCs, **When** the request is processed, **Then** the system returns an empty result set without error

---

### User Story 4 - Contextual Music Recommendations (Priority: P2)

As a music enthusiast, I want to have a conversation with the AI agent about my music preferences and receive personalized playlist suggestions that combine familiar tracks from my library with new discoveries, so that I can enjoy curated listening experiences that match my mood.

**Why this priority**: This represents the complete user experience enabled by the tools working together. Slightly lower priority because it depends on the individual tools (P1 stories) being functional first.

**Independent Test**: Can be fully tested by having a multi-turn conversation where the user describes their mood, the agent searches both semantic index and Tidal catalogue, and presents a cohesive set of recommendations mixing library and discovery tracks.

**Acceptance Scenarios**:

1. **Given** I describe my mood to the agent as "I want something energetic for a workout", **When** the agent processes my request, **Then** it uses both semantic search (for indexed tracks) and Tidal search (for discoveries) to compile recommendations
2. **Given** the agent has found matching tracks, **When** it presents recommendations, **Then** each track clearly indicates whether it's from my library, indexed but not in library, or a new discovery from Tidal
3. **Given** I ask for a mix of familiar and new music, **When** the agent builds recommendations, **Then** it includes tracks from my library alongside new discoveries from the Tidal catalogue
4. **Given** I provide feedback on a recommendation ("I don't like heavy metal"), **When** the agent refines its search, **Then** subsequent recommendations respect my stated preferences

---

### User Story 5 - Transparent Agent Workflow (Priority: P1)

As a music enthusiast watching the AI agent work, I want to see in real-time which searches the agent is performing and what results it's finding, so that I understand how the agent is building its recommendations and feel engaged in the discovery process.

**Why this priority**: Transparency in agent behavior is critical for user trust and engagement. Showing the agent's work as it happens makes the interaction feel more collaborative and less like a black box.

**Independent Test**: Can be fully tested by asking the agent for playlist recommendations and observing streamed tool invocation events appearing in the chat interface as the agent searches.

**Acceptance Scenarios**:

1. **Given** I ask the agent for music recommendations, **When** the agent begins a semantic search, **Then** I see a visual indicator that the agent is "Searching indexed tracks for [query]"
2. **Given** the agent is performing a Tidal catalogue search, **When** the search is in progress, **Then** I see the search being executed with its parameters visible
3. **Given** a tool invocation completes, **When** results are available, **Then** I see a summary of what was found before the agent continues processing
4. **Given** a tool invocation fails, **When** the error occurs, **Then** I see clear feedback about the failure and what the agent will do next
5. **Given** the agent is building a playlist using multiple tools, **When** I watch the conversation, **Then** I can follow the entire workflow as each search is performed and results are gathered
6. **Given** a tool invocation completes with results, **When** I view the summary, **Then** I can click to expand and see the full list of results returned by that tool

---

### Edge Cases

- What happens when the vector index is unavailable during semantic search? The agent should inform the user that semantic search is temporarily unavailable and suggest using Tidal catalogue search instead.
- What happens when the Tidal API is unavailable during catalogue search? The agent should inform the user that catalogue search is temporarily unavailable and suggest searching the indexed collection instead.
- What happens when a track exists in Tidal but has never been ingested? The agent should show the track with an "not indexed" flag and basic Tidal metadata only.
- What happens when a track was previously ingested but is no longer available on Tidal? The agent should show the indexed metadata and indicate the track may not be currently available for streaming.
- What happens when the user asks for tracks by ISRC but provides invalid ISRC formats? The agent should validate ISRC format and report which ISRCs are malformed.
- What happens when batch metadata retrieval is requested for more than 100 tracks? The system should process requests up to 100 ISRCs per call; larger requests should be rejected with guidance to use multiple calls.
- What happens when semantic search returns tracks that are no longer in the user's library (removed after indexing)? The library status flag should reflect current library membership, not historical state.
- What happens when the agent searches for extremely common terms that would return thousands of results? The system should return a reasonable limit (configurable, default 20 for semantic, 100 for Tidal) with an indication that more results exist.
- What happens when the user interrupts the chat while a tool is executing? The tool execution should be cancelled, any partial results should be discarded, and the user should see that the operation was interrupted.
- What happens when streaming is interrupted mid-tool-invocation? The user should see the last known state and an indication that the connection was lost; no incomplete results should be presented as final.

## Requirements *(mandatory)*

### Functional Requirements

#### Semantic Library Search Tool

- **FR-001**: System MUST provide a semantic search tool that the chat agent can invoke to search the vector index for tracks matching a natural language query
- **FR-002**: System MUST return semantic search results ranked by relevance score using the existing hybrid search mechanism (vector similarity + BM25)
- **FR-003**: System MUST include all available metadata for each search result: title, artist, album, ISRC, lyrics, interpretation, and audio features where available
- **FR-004**: System MUST include a boolean flag indicating whether each result track is currently in the user's library
- **FR-005**: System MUST support configurable result limits for semantic search with a default of 20 and maximum of 50 results per query
- **FR-006**: System MUST handle empty result sets gracefully by returning an empty list with no error

#### Tidal Catalogue Search Tool

- **FR-007**: System MUST provide a Tidal search tool that the chat agent can invoke to search the Tidal catalogue by text query
- **FR-008**: System MUST support searching for tracks, albums, or both via the Tidal search tool
- **FR-009**: System MUST include a boolean flag indicating whether each track result is in the user's library
- **FR-010**: System MUST include a boolean flag indicating whether each track result has been ingested into the vector index
- **FR-011**: System MUST include a boolean flag indicating whether each album result is in the user's library
- **FR-012**: System MUST return album results with basic metadata: title, artist, artwork URL, release date, track count
- **FR-013**: System MUST return track results with basic metadata: title, artist, album name, duration, ISRC, artwork URL
- **FR-014**: System MUST support configurable result limits for Tidal search with a default of 20 and maximum of 100 results per query
- **FR-015**: System MUST provide album track listing capability to retrieve all tracks for a specific album by album ID

#### Batch Track Metadata Retrieval Tool

- **FR-016**: System MUST provide a batch metadata retrieval tool that accepts a list of ISRCs and returns full metadata for all matching indexed tracks
- **FR-017**: System MUST validate ISRC format (ISO 3901: 12 alphanumeric characters) before processing requests
- **FR-018**: System MUST return partial results when some requested ISRCs are found and others are not
- **FR-019**: System MUST clearly indicate which requested ISRCs were not found in the response
- **FR-020**: System MUST support batch requests of up to 100 ISRCs per call
- **FR-021**: System MUST reject requests exceeding 100 ISRCs with an appropriate error message

#### Tool Integration Requirements

- **FR-022**: All tools MUST be invocable by the chat agent during conversation context
- **FR-023**: All tool responses MUST be structured in a consistent format suitable for the agent to process and present to users
- **FR-024**: System MUST trace all tool invocations to Langfuse as nested spans including: tool name, full input parameters, output (result count for display, full output for debugging), execution duration in milliseconds, and error details if failed
- **FR-025**: System MUST handle external service failures (vector index, Tidal API, database) gracefully and return meaningful error information to the agent
- **FR-026**: System MUST maintain conversation context so the agent can reference previous tool results in subsequent turns
- **FR-033**: System MUST automatically retry a tool invocation once after a transient failure (timeout, connection error) with a brief delay before reporting failure to the user

#### Tool Invocation Streaming Requirements

- **FR-027**: System MUST stream tool invocation events to the user interface in real-time as the agent works
- **FR-028**: System MUST display which tool the agent is invoking and its parameters before execution begins
- **FR-029**: System MUST display tool execution status (in progress, completed, failed) as it changes
- **FR-030**: System MUST display tool results as a concise summary (result count and query snippet) upon completion
- **FR-034**: System MUST make tool result summaries expandable so users can click to view full result details
- **FR-031**: System MUST allow users to observe the agent's search process as it builds playlist recommendations
- **FR-032**: Tool invocation streaming MUST integrate with the existing chat response streaming mechanism from 010-discover-chat

### Key Entities

- **Semantic Search Query**: A natural language description of the desired music theme, mood, or characteristics. Used by the agent to search the vector index. Attributes include query text and optional result limit.
- **Semantic Search Result**: A track returned from vector index search with full metadata (title, artist, album, ISRC, lyrics, interpretation, audio features) plus relevance score and library membership flag.
- **Tidal Search Query**: Text query for searching the Tidal catalogue. Attributes include query text, search type (tracks/albums/both), and optional result limit.
- **Tidal Search Result**: A track or album returned from Tidal API with basic metadata plus flags for library membership and (for tracks) vector index ingestion status.
- **ISRC Batch Request**: A list of ISRCs (up to 100) for which the agent requests full track metadata from the vector index.
- **Track Metadata**: Complete information about an indexed track including title, artist, album, ISRC, lyrics, interpretation text, and all 11 audio features from ReccoBeats.
- **Tool Invocation Event**: A streamed event representing the lifecycle of a tool call. Attributes include tool name, input parameters, status (pending/executing/completed/failed), result summary, error message (if failed), and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent can complete a semantic search and receive results within 3 seconds for typical queries
- **SC-002**: Agent can complete a Tidal catalogue search and receive results within 3 seconds for typical queries
- **SC-003**: Agent can retrieve batch metadata for up to 100 ISRCs within 2 seconds
- **SC-004**: 100% of semantic search results include accurate library membership status
- **SC-005**: 100% of Tidal search results include accurate library membership and ingestion status flags
- **SC-006**: All tool invocations are traced in the observability platform with complete input/output data
- **SC-007**: Agent successfully combines results from multiple tools to fulfill complex user requests (e.g., mood-based playlist mixing library and discovery tracks)
- **SC-008**: Users receive clear feedback when a tool operation fails, including guidance on alternative approaches
- **SC-009**: Users see tool invocation events streamed to the interface within 500ms of each tool lifecycle change
- **SC-010**: 100% of tool invocations are visible to the user in real-time during agent workflow

## Assumptions

- The chat agent infrastructure (from 010-discover-chat) is operational and can invoke tools
- The vector search index (from 004-vector-search-index) is available with indexed tracks containing all metadata fields
- The semantic discovery search mechanism (from 009-semantic-discovery-search) is available for the agent to leverage
- The Tidal API search functionality (from 001-tidal-search) is operational
- The library management system (from 002-library-management) provides APIs to check track/album library membership
- The LLM observability infrastructure (from 005-llm-observability) is available for tracing tool invocations
- Tool responses will be formatted for LLM consumption (structured data that Claude can interpret and present naturally)
- The chat agent will handle presentation of tool results to users; tools return structured data only
- ISRC serves as the reliable unique identifier for tracks across Tidal catalogue and vector index

## Dependencies

- **specs/010-discover-chat**: Provides the chat agent framework that will invoke these tools
- **specs/009-semantic-discovery-search**: Provides hybrid semantic search over indexed tracks
- **specs/004-vector-search-index**: Provides the Qdrant vector index with track metadata
- **specs/002-library-management**: Provides library membership lookup for tracks and albums
- **specs/001-tidal-search**: Provides Tidal API search capabilities
- **specs/005-llm-observability**: Provides Langfuse tracing for tool invocations

## Scope Boundaries

### In Scope

- Semantic search tool for the chat agent to query indexed tracks by mood/theme
- Tidal catalogue search tool for the chat agent to search by artist/album/track
- Batch ISRC metadata retrieval tool for efficient multi-track lookups
- Library membership flags on all search results
- Ingestion status flags on Tidal search results
- Tool observability and tracing
- Consistent structured response format for all tools
- Real-time streaming of tool invocation events to the user interface
- Integration with existing chat response streaming mechanism

### Out of Scope

- Playlist creation or persistence (future feature)
- Adding tracks to library via agent tools (future feature - agent can recommend, user adds manually)
- Audio playback or preview functionality
- Real-time streaming status checks for tracks
- Personalization based on listening history (future feature)
- Multi-user support or user-specific tool permissions
- Offline operation or caching of tool results
- Tool rate limiting beyond existing API rate limits
- Custom ranking or filtering of results beyond what underlying systems provide
