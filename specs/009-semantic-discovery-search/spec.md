# Feature Specification: Semantic Discovery Search

**Feature Branch**: `009-semantic-discovery-search`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Natural language search for music fitting a particular theme that's indexed by the vector search index. The search feature should not be confused with the Tidal search used for library management. Instead, this focuses on deeper search results based on the tracks which have been indexed and have lyrics. The search should leverage a hybrid score based on: the embedding vector of the track's interpretation, BM25 search of the track's interpretation, and BM25 search of the track's lyrics. The search input should be a natural language box taking anything from a bag of keywords to a short sentence to a paragraph describing the mood that the user is searching for. Under the hood, this input should be converted into 1 to 3 search natural language queries using Claude Haiku 4.5 for search translation. The natural language queries should be turned into embedding vectors using the embedding service. The top 20 results should be displayed in order of descending score, with pagination support up to 100 results in total. Each row should be expandable as per 008-track-metadata-display. The new search functionality should be placed in a new 'Discover' area alongside 'Search' and 'Library'."

## Clarifications

### Session 2025-12-30

- Q: How should the three score components (vector similarity, BM25 on interpretation, BM25 on lyrics) be combined into the final ranking score? → A: Use Qdrant's built-in Reciprocal Rank Fusion (RRF) for score combination

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Natural Language Music Discovery (Priority: P1)

As a music listener, I want to describe the mood, theme, or feeling I'm looking for in natural language and receive a list of tracks from my indexed collection that match my description, so that I can discover music based on meaning and emotion rather than just titles or artist names.

**Why this priority**: This is the core value proposition of the entire feature - enabling semantic discovery of music through natural language. Without this working end-to-end, there is no feature.

**Independent Test**: Can be fully tested by entering a natural language query like "uplifting songs about overcoming adversity" in the Discover search box, submitting, and verifying that relevant indexed tracks are returned ranked by hybrid score with their titles, artists, and albums displayed.

**Acceptance Scenarios**:

1. **Given** I am on the Discover page, **When** I enter "songs about heartbreak and moving on" and submit, **Then** I see a list of tracks whose lyrics and interpretations relate to heartbreak and moving on, ranked by relevance score
2. **Given** I am on the Discover page, **When** I enter a single keyword like "summer", **Then** I see tracks whose themes relate to summer, warm weather, or associated moods
3. **Given** I am on the Discover page, **When** I enter a paragraph describing a complex mood like "I want something melancholic but hopeful, about late nights and reflection", **Then** the system processes my input and returns relevant tracks
4. **Given** search results are displayed, **When** I view the results, **Then** each result shows the track title, artist name, album name, and album artwork
5. **Given** I perform a search, **When** results are loading, **Then** I see a loading indicator until results are ready

---

### User Story 2 - Expandable Track Details in Discovery Results (Priority: P1)

As a music listener reviewing discovery results, I want to expand individual tracks to see their lyrics, interpretation, and audio features, so that I can understand why a track was matched and decide if it fits what I'm looking for.

**Why this priority**: Discovery results are only useful if users can evaluate why tracks were matched. The expandable detail view (per 008-track-metadata-display) provides the context users need to validate matches.

**Independent Test**: Can be tested by performing a discovery search, clicking on a result track, and verifying that the accordion expands to show lyrics, interpretation, and audio features for that track.

**Acceptance Scenarios**:

1. **Given** I have discovery search results, **When** I click on a track row, **Then** an accordion panel expands below showing the track's lyrics, interpretation, and available audio features
2. **Given** a track's accordion is expanded in discovery results, **When** I click on a different track, **Then** the previously expanded accordion collapses and the new one expands
3. **Given** a track's accordion is expanded, **When** I click the same track row, **Then** the accordion collapses
4. **Given** I expand a track with no lyrics (instrumental), **When** viewing the expanded panel, **Then** I see appropriate messaging indicating no lyrics are available

---

### User Story 3 - Paginated Discovery Results (Priority: P2)

As a music listener exploring discovery results, I want to browse through multiple pages of results up to 100 tracks total, so that I can explore beyond the initial results and find tracks that may appear later in the ranked list.

**Why this priority**: While the top 20 results provide immediate value, users may want to explore deeper into the result set. Pagination extends usability without being critical to core functionality.

**Independent Test**: Can be tested by performing a search that returns many results, scrolling to the bottom of the initial 20, clicking "Load More" or navigating to page 2, and verifying additional results are displayed up to 100 total.

**Acceptance Scenarios**:

1. **Given** a search returns more than 20 matching tracks, **When** I view results, **Then** I initially see the top 20 results with an option to load more or navigate to additional pages
2. **Given** I am viewing the first 20 results, **When** I request more results, **Then** the next batch of results (up to 20 more) is loaded and displayed
3. **Given** I have loaded multiple batches, **When** the total reaches 100 tracks, **Then** no further results can be loaded and I see messaging indicating the maximum has been reached
4. **Given** fewer than 20 tracks match my search, **When** viewing results, **Then** all matching tracks are displayed without pagination controls

---

### User Story 4 - Navigation to Discover Area (Priority: P2)

As a music listener, I want to access the Discover feature from the main navigation alongside Search and Library, so that I can easily switch between finding new music on Tidal, exploring my indexed collection semantically, and browsing my saved library.

**Why this priority**: Proper navigation placement ensures discoverability of the feature. Users need to find Discover alongside existing navigation options.

**Independent Test**: Can be tested by loading the application and verifying a "Discover" navigation item appears alongside "Search" and "Library", and clicking it navigates to the Discover page.

**Acceptance Scenarios**:

1. **Given** I am using the application, **When** I look at the main navigation, **Then** I see a "Discover" option alongside "Search" and "Library"
2. **Given** I click on "Discover" in the navigation, **When** the page loads, **Then** I see a natural language search input prominently displayed
3. **Given** I am on the Discover page, **When** I click "Search" in navigation, **Then** I navigate to the Tidal search page (library management search)
4. **Given** I am on the Discover page, **When** I click "Library" in navigation, **Then** I navigate to my saved library

---

### User Story 5 - No Results Handling (Priority: P2)

As a music listener, I want clear feedback when my discovery search doesn't match any indexed tracks, so that I understand whether to adjust my query or if my indexed collection simply doesn't contain relevant tracks.

**Why this priority**: Empty results without explanation frustrate users. Clear messaging helps users understand the system and adjust their approach.

**Independent Test**: Can be tested by searching for a very specific or unusual theme that likely has no matches, and verifying helpful feedback is shown instead of an empty page.

**Acceptance Scenarios**:

1. **Given** I search for a theme with no matching indexed tracks, **When** results return, **Then** I see a message indicating no tracks were found matching my description
2. **Given** no results are found, **When** I view the message, **Then** I receive suggestions to try different search terms or broaden my description
3. **Given** the indexed collection is empty (no tracks ingested), **When** I perform any search, **Then** I see a message indicating there are no indexed tracks to search

---

### Edge Cases

- What happens when the user enters only whitespace or an empty query? The system should display a validation message asking the user to enter a search term.
- What happens when the LLM query translation service is unavailable? The system should display an error message and allow retry; searches should not proceed without query expansion.
- What happens when the embedding service is unavailable? The system should display an error indicating the search cannot be completed and allow retry.
- What happens when the vector search index is unavailable? The system should display an error message indicating the search service is temporarily unavailable.
- What happens when the user enters extremely long input? The system enforces a 2000 character limit; users must shorten their query if it exceeds this limit.
- What happens when the LLM generates fewer than the requested 1-3 queries? The system proceeds with whatever queries were generated (minimum 1).
- What happens when the hybrid search returns duplicate tracks from different query expansions? Results should be deduplicated, keeping the highest score for each track.
- What happens when network latency causes search to take longer than expected? A loading indicator should remain visible, and the search should timeout gracefully after a reasonable period (e.g., 30 seconds) with an error message.
- What happens when results come from tracks with very short or fragmentary lyrics? These tracks are included if their interpretation matches; the ranking algorithm handles varying content quality.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Discover page accessible from the main navigation alongside Search and Library
- **FR-002**: System MUST provide a natural language search input that accepts text ranging from single keywords to multi-paragraph descriptions
- **FR-003**: System MUST validate that the search input is not empty, not whitespace-only, and no more than 2000 characters before processing
- **FR-004**: System MUST convert user input into 1 to 3 natural language search queries using Claude Haiku 4.5 for query expansion and intent extraction
- **FR-005**: System MUST generate embedding vectors for each expanded query using the embedding service (same model used for track ingestion)
- **FR-006**: System MUST execute hybrid search combining: vector similarity on interpretation_embedding field, BM25 keyword search on interpretation field, and BM25 keyword search on lyrics field
- **FR-007**: System MUST aggregate and rank results by a combined hybrid score using Reciprocal Rank Fusion (RRF) across all query expansions
- **FR-008**: System MUST deduplicate results when multiple query expansions return the same track, preserving the highest score
- **FR-009**: System MUST return search results ordered by descending hybrid score
- **FR-010**: System MUST display the top 20 results initially, with each result showing track title, artist name, album name, and album artwork
- **FR-011**: System MUST support pagination allowing users to load additional results in batches up to 100 total results
- **FR-012**: System MUST provide an expandable accordion for each result row displaying lyrics, interpretation, and audio features (consistent with 008-track-metadata-display)
- **FR-013**: System MUST ensure only one result accordion is expanded at a time
- **FR-014**: System MUST display a loading indicator while search is in progress
- **FR-015**: System MUST display appropriate messaging when no results match the search query
- **FR-016**: System MUST handle errors from external services (LLM, embedding service, search index) gracefully with user-friendly error messages and retry options
- **FR-017**: System MUST log all LLM invocations, embedding generations, and search operations to the observability platform for debugging and cost tracking
- **FR-018**: System MUST timeout search operations after 30 seconds and display an appropriate error message

### Key Entities

- **Discovery Query**: User-provided natural language text describing the mood, theme, or feeling they are searching for; can range from a single keyword to multiple paragraphs
- **Expanded Queries**: 1 to 3 natural language search queries generated by Claude Haiku 4.5 from the user's input, optimized for semantic and keyword matching
- **Query Embedding**: 1024-dimensional vector representation of an expanded query, generated by the same embedding model used for track ingestion
- **Hybrid Search Score**: Combined relevance score for a track, computed using Reciprocal Rank Fusion (RRF) from vector similarity (interpretation embedding) and BM25 scores (interpretation text + lyrics text)
- **Discovery Result**: A track returned from the search, including track metadata (title, artist, album, artwork) and expandable extended metadata (lyrics, interpretation, audio features)
- **Result Page**: A batch of up to 20 discovery results; the system supports up to 5 pages (100 results total)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a discovery search and see results within 10 seconds for typical queries (including LLM query expansion and hybrid search)
- **SC-002**: Search results demonstrate semantic relevance: tracks returned for a mood-based query should thematically relate to the described mood based on their interpretations
- **SC-003**: 100% of discovery searches either return relevant results or display clear "no results" messaging
- **SC-004**: Users can browse through paginated results up to 100 tracks without errors
- **SC-005**: The expanded track details (lyrics, interpretation, audio features) load within 3 seconds of clicking a result row
- **SC-006**: All LLM and search operations are logged in the observability platform with trace correlation for debugging
- **SC-007**: The Discover navigation item is visible and accessible from all pages in the application

## Assumptions

- The vector search index (specs/004-vector-search-index) is operational with indexed tracks containing interpretation_embedding, interpretation text, and lyrics text
- The embedding service from the track ingestion pipeline (specs/006-track-ingestion-pipeline) is available for generating query embeddings
- The LLM observability infrastructure (specs/005-llm-observability) is available for logging LLM invocations and search operations
- Claude Haiku 4.5 is available via the Anthropic API for query expansion
- The embedding model used is mxbai-embed-large-v1 producing 1024-dimensional vectors (per 006-track-ingestion-pipeline implementation notes)
- The hybrid search scoring approach follows Qdrant's recommended patterns for combining vector and BM25 scores
- Track metadata display accordion behavior follows the patterns established in 008-track-metadata-display
- Album artwork URLs are available from indexed track documents or can be retrieved via track identifiers

## Dependencies

- **specs/004-vector-search-index**: Qdrant index with hybrid search capabilities (vector similarity + BM25)
- **specs/005-llm-observability**: Langfuse tracing for LLM calls and search operations
- **specs/006-track-ingestion-pipeline**: Embedding service (TEI with mxbai-embed-large-v1) for query embedding generation
- **specs/008-track-metadata-display**: Accordion component and extended metadata display patterns
- **External: Anthropic API**: Claude Haiku 4.5 for query expansion

## Scope Boundaries

### In Scope

- Discover page with natural language search input
- Navigation integration (Discover alongside Search and Library)
- LLM-powered query expansion (1-3 queries from user input)
- Embedding generation for expanded queries
- Hybrid search combining vector similarity and BM25 on indexed tracks
- Result ranking by hybrid score
- Result display with track metadata and album artwork
- Pagination up to 100 results
- Expandable track details (lyrics, interpretation, audio features)
- Error handling and loading states
- Observability logging for all operations

### Out of Scope

- Saving or bookmarking search queries
- Search history or recent searches
- Filtering results by audio features (future enhancement)
- Personalized recommendations based on user listening history
- Real-time streaming of results as they are found
- Alternative search modes (pure keyword, pure vector)
- Adding tracks to library directly from discovery results (requires library management integration)
- Playback integration or preview functionality
- Exporting or sharing search results
- Custom weighting of hybrid score components
- Non-English language query support (queries must be in English)
