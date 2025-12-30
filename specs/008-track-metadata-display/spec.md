# Feature Specification: Track Metadata Display

**Feature Branch**: `008-track-metadata-display`
**Created**: 2025-12-30
**Status**: Draft
**Input**: User description: "Display for track metadata (especially lyrics and interpretation) for songs which are already indexed by specs/006-track-ingestion-pipeline/spec.md when browsing the user library introduced in specs/002-library-management/spec.md. The frontend should show a popover with the track details in the album track list and the library track list when the track is already indexed (note that not all tracks in the index have lyrics and interpretation). The additional track metadata should be fetched as required for the frontend to display."

## Clarifications

### Session 2025-12-30

- Q: What is the trigger mechanism for viewing track details? → A: Accordion-style UI - clicking on track row expands details below; maximum one track expanded at a time.
- Q: When should indexed status be fetched for visual indicators? → A: Fetch indexed status for all visible tracks when loading the view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Indexed Track Details from Library (Priority: P1)

As a music listener browsing my personal library, I want to see enriched track metadata (lyrics and interpretation) for tracks that have been indexed, so that I can understand the themes and content of my saved music without leaving the library view.

**Why this priority**: This is the core value proposition - surfacing the enriched data that the ingestion pipeline has created. Without this, users have no way to access the indexed metadata, making the ingestion pipeline invisible to end users.

**Independent Test**: Can be fully tested by adding a track to the library that has been indexed (with lyrics and interpretation), navigating to the Tracks view, clicking on the track row, and verifying that an accordion panel expands below displaying the lyrics and interpretation alongside other metadata.

**Acceptance Scenarios**:

1. **Given** I am viewing the Tracks view in my library and a track has been indexed with lyrics and interpretation, **When** I click on the track row, **Then** an accordion panel expands below the row displaying the track's title, artist, album, duration, lyrics, and interpretation
2. **Given** I am viewing an album's track listing in my library and a track within that album has been indexed, **When** I click on the track row, **Then** an accordion panel expands below displaying the track's lyrics and interpretation if available
3. **Given** I expand a track's details, **When** the metadata is being fetched, **Then** I see a loading indicator in the expanded panel until the data is ready
4. **Given** a track's accordion panel is expanded, **When** I click on a different track row, **Then** the currently expanded panel collapses and the new track's panel expands (only one expanded at a time)
5. **Given** a track's accordion panel is expanded, **When** I click on the same track row again, **Then** the panel collapses

---

### User Story 2 - Graceful Handling of Tracks Without Extended Metadata (Priority: P1)

As a music listener, I want to see appropriate feedback when a track has been indexed but lacks lyrics or interpretation (e.g., instrumental tracks), so that I understand why certain metadata is not displayed.

**Why this priority**: Not all indexed tracks have lyrics (instrumentals) or interpretations. Users need clear feedback to understand that missing data is intentional, not a system error.

**Independent Test**: Can be tested by adding an instrumental track (no lyrics) to the library, ensuring it's indexed, expanding its details accordion, and verifying that the interface clearly indicates "No lyrics available" or similar messaging.

**Acceptance Scenarios**:

1. **Given** a track is indexed but has no lyrics (instrumental), **When** I expand its details accordion, **Then** I see a clear message indicating the track has no lyrics, and no interpretation is shown
2. **Given** a track is indexed with lyrics but the interpretation failed to generate, **When** I expand its details accordion, **Then** I see the lyrics but a message indicating no interpretation is available
3. **Given** a track exists in my library but has not been indexed at all, **When** I click on it, **Then** either no accordion expansion is available, or the accordion indicates that extended metadata is not yet available

---

### User Story 3 - View Audio Features for Indexed Tracks (Priority: P2)

As a music listener, I want to see audio features (tempo, energy, danceability, etc.) for indexed tracks, so that I can understand the musical characteristics of my saved songs.

**Why this priority**: Audio features provide additional value beyond lyrics and interpretation. They're useful for understanding a track's musical properties but are secondary to the primary semantic content (lyrics/interpretation).

**Independent Test**: Can be tested by expanding the details accordion for an indexed track that has audio features and verifying that available audio feature values are displayed.

**Acceptance Scenarios**:

1. **Given** a track is indexed with audio features, **When** I expand its details accordion, **Then** I see available audio features (tempo, energy, danceability, acousticness, instrumentalness, etc.) displayed with human-readable labels
2. **Given** a track is indexed but audio features are unavailable, **When** I expand its details accordion, **Then** the audio features section is either hidden or shows a message indicating they are unavailable
3. **Given** audio features are displayed, **When** I view them, **Then** numeric values are presented in a user-friendly format (e.g., percentages, BPM)

---

### User Story 4 - Visual Indicator for Indexed Tracks (Priority: P3)

As a music listener browsing my library, I want to see a visual indicator on tracks that have been indexed, so that I can quickly identify which tracks have enriched metadata available.

**Why this priority**: A visual indicator helps users discover which tracks have additional metadata without having to click each one. This improves discoverability and user experience but is not essential for core functionality.

**Independent Test**: Can be tested by having a mix of indexed and non-indexed tracks in the library, navigating to the Tracks view, and verifying that indexed tracks display a distinct visual indicator (icon, badge, or styling).

**Acceptance Scenarios**:

1. **Given** I am viewing the Tracks view in my library, **When** a track has been indexed, **Then** a visual indicator (such as an icon or badge) is displayed next to the track
2. **Given** I am viewing an album's track listing, **When** tracks within that album have been indexed, **Then** those tracks display a visual indicator distinguishing them from non-indexed tracks
3. **Given** a track is not indexed, **When** I view it in any list, **Then** no indexed indicator is shown

---

### Edge Cases

- What happens when the user clicks a track but the metadata fetch fails due to network issues? The accordion panel displays an error message with a retry option.
- What happens when the user rapidly clicks multiple tracks? Each click should cancel any pending fetch, collapse the previous panel, and expand the newly selected track's panel with its metadata.
- What happens when lyrics are very long? Lyrics should be displayed in a scrollable container within the accordion panel.
- What happens when the search index service is unavailable? The visual indicator for indexed status should either not appear or show as "unknown"; attempting to expand details should display an appropriate error in the accordion panel.
- What happens when a track is indexed while the user is viewing the library? The indexed status should update on the next page load or refresh; real-time updates are out of scope.
- What happens when audio features contain extreme values (e.g., tempo of 0 or 300)? Display values as-is; the data comes from the ingestion pipeline and should be trusted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an accordion UI component that expands below the track row to display extended track metadata when the user clicks on a track
- **FR-002**: System MUST display track lyrics in the accordion panel when available for indexed tracks
- **FR-003**: System MUST display track interpretation in the accordion panel when available for indexed tracks
- **FR-004**: System MUST display audio features (acousticness, danceability, energy, instrumentalness, key, liveness, loudness, mode, speechiness, tempo, valence) in the accordion panel when available
- **FR-005**: System MUST fetch extended track metadata on demand when the user expands a track's accordion (not pre-loaded)
- **FR-006**: System MUST show a loading state in the accordion panel while fetching track metadata
- **FR-007**: System MUST handle and display appropriate messaging when lyrics are unavailable (instrumental tracks)
- **FR-008**: System MUST handle and display appropriate messaging when interpretation is unavailable
- **FR-009**: System MUST handle and display appropriate messaging when audio features are unavailable
- **FR-010**: System MUST display a visual indicator on tracks that have been indexed in the vector search index
- **FR-011**: System MUST ensure only one track accordion is expanded at a time; expanding a new track collapses any previously expanded track
- **FR-012**: System MUST collapse an expanded accordion when the same track row is clicked again
- **FR-013**: System MUST display an error message with retry option in the accordion panel when metadata fetch fails
- **FR-014**: System MUST support the accordion in the library Tracks view for individually saved tracks
- **FR-015**: System MUST support the accordion in the album track listing within the library Albums view
- **FR-016**: System MUST provide a backend endpoint to retrieve extended track metadata by track identifier (ISRC)
- **FR-017**: System MUST provide a backend endpoint to check indexed status for a list of track identifiers (batch lookup)
- **FR-018**: System MUST fetch indexed status for all tracks in the current view when the library view loads, to display visual indicators immediately
- **FR-019**: System MUST query the vector search index to retrieve lyrics, interpretation, and audio features for display
- **FR-020**: System MUST format audio feature values for human readability (percentages, BPM, musical keys)

### Key Entities

- **Extended Track Metadata**: Additional information about a track retrieved from the vector search index, including lyrics (plain text), interpretation (natural language summary of themes), audio features (11 numeric properties), and indexed status (boolean)
- **Indexed Status**: A flag indicating whether a track has been processed by the ingestion pipeline and exists in the vector search index; used to show visual indicators and determine if extended metadata can be fetched
- **Track Accordion**: A UI component that expands below the track row to display extended track metadata inline within the list, triggered by clicking on a track row; only one accordion can be expanded at a time

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view extended metadata (lyrics and interpretation) for indexed tracks within 3 seconds of expanding the accordion
- **SC-002**: 100% of indexed tracks in the library display a visual indicator distinguishing them from non-indexed tracks
- **SC-003**: Users receive clear feedback for 100% of tracks that lack lyrics or interpretation, explaining why the data is unavailable
- **SC-004**: The accordion displays audio features for indexed tracks that have them, with human-readable formatting
- **SC-005**: Metadata fetch errors are communicated to users with a retry option, maintaining user trust and control
- **SC-006**: The accordion is accessible from both the Tracks view and album track listings in the library, covering 100% of library contexts where tracks are displayed

## Assumptions

- The vector search index (specs/004-vector-search-index) is operational and contains indexed track data from the ingestion pipeline
- The track ingestion pipeline (specs/006-track-ingestion-pipeline) populates the index with ISRC-keyed documents containing lyrics, interpretation, and audio features
- The library management system (specs/002-library-management) stores Tidal track identifiers that can be cross-referenced with indexed data via ISRC
- Tracks in the library have ISRC identifiers available for querying the vector index
- The frontend framework supports accordion components with loading states and error handling
- Users browse their library one track at a time for details; bulk metadata viewing is out of scope
- Real-time synchronization of indexed status is not required; status can be refreshed on page load

## Dependencies

- **specs/002-library-management**: Library browsing UI (Tracks view, Albums view with track listings)
- **specs/004-vector-search-index**: Qdrant index containing indexed track documents with lyrics, interpretation, embedding, and audio features
- **specs/006-track-ingestion-pipeline**: Pipeline that populates the vector index with track data; defines the document schema

## Scope Boundaries

### In Scope

- Accordion UI for displaying extended track metadata (lyrics, interpretation, audio features) inline below track rows
- Single-expansion behavior (only one track accordion expanded at a time)
- On-demand fetching of extended metadata from the vector search index
- Visual indicator for indexed tracks in library views
- Loading states and error handling for metadata fetching
- Backend endpoint(s) to retrieve extended metadata and check indexed status
- Formatting of audio features for display

### Out of Scope

- Editing or modifying track metadata from the UI
- Real-time updates of indexed status while viewing the library
- Search or filtering library by metadata content (lyrics, interpretation)
- Displaying embeddings (raw vectors are not user-facing)
- Triggering track ingestion from the library UI (handled separately)
- Playlist-level metadata aggregation or statistics
- Offline caching of extended metadata
