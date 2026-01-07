# Feature Specification: Playlist Suggestion Agent Tool

**Feature Branch**: `015-playlist-suggestion`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "A new agent tool for suggesting a playlist to the user. To call the tool, the agent should provide a title for the playlist, and for each track: the ISRC, the title and artist name, and a one sentence reasoning for why the track is relevant. The backend should then retrieve the full track details for the track using the batch tracks endpoint on the Tidal API, and then retrieve the albums along with their respective cover art corresponding to those tracks from the albums endpoint. It should then pass that information to the UI in an SSE message, which should use it to present the playlist to inside the agent chat, inline at the point at which the agent generates it. The track reasoning should be hidden by default and revealed if the user clicks on the track in an accordion style control."

## Clarifications

### Session 2026-01-02

- Q: What size should album artwork be displayed at? → A: Standard size (160x160px)
- Q: Should Tidal API enrichment retry on failure before falling back? → A: Retry once (1 second delay) before falling back to agent-provided data

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Presents a Curated Playlist (Priority: P1)

As a music enthusiast chatting with the AI agent, I want the agent to present a visually rich playlist suggestion inline in the chat with album artwork and track details, so that I can immediately see and appreciate the curated selection without leaving the conversation.

**Why this priority**: This is the core value proposition - transforming the agent's text-based track recommendations into an engaging visual playlist experience. Without this, users receive a plain text list which is harder to scan and less engaging.

**Independent Test**: Can be fully tested by asking the agent "Create a workout playlist" and verifying a visual playlist card appears in the chat with album artwork, track titles, and artist names for each suggested track.

**Acceptance Scenarios**:

1. **Given** I ask the agent for a playlist recommendation, **When** the agent decides to present a playlist, **Then** I see a visually distinct playlist card inline in the chat message
2. **Given** the agent presents a playlist, **When** I view the playlist card, **Then** I see the playlist title at the top of the card
3. **Given** the agent presents a playlist with tracks, **When** I view the playlist card, **Then** each track displays its album cover art, track title, and artist name
4. **Given** the agent includes a track in the playlist, **When** the playlist is displayed, **Then** the track's reasoning is hidden by default to keep the interface clean
5. **Given** the playlist is displayed, **When** I count the visible tracks, **Then** all tracks included by the agent are shown (no artificial limit on display)

---

### User Story 2 - Revealing Track Reasoning (Priority: P1)

As a music enthusiast curious about why certain tracks were chosen, I want to click on a track to reveal the agent's reasoning for including it, so that I can understand the connection between my request and the suggested music.

**Why this priority**: Equally critical as the visual presentation - the reasoning provides transparency and educational value, helping users understand the agent's music knowledge and building trust in recommendations.

**Independent Test**: Can be fully tested by clicking on any track in a playlist suggestion and verifying an accordion-style expansion reveals a one-sentence explanation of why that track was selected.

**Acceptance Scenarios**:

1. **Given** a playlist is displayed with tracks, **When** I click on a track row, **Then** the track expands accordion-style to reveal the reasoning text
2. **Given** I have expanded a track's reasoning, **When** I click on the same track again, **Then** the reasoning collapses and is hidden
3. **Given** I have expanded one track, **When** I click on a different track, **Then** the new track expands and the previous track collapses (single expansion mode)
4. **Given** the agent provides a reasoning for each track, **When** I view the expanded reasoning, **Then** the text is a single concise sentence explaining relevance

---

### User Story 3 - Playlist Appears During Streaming (Priority: P1)

As a music enthusiast watching the agent work, I want to see the playlist appear in real-time as the agent generates it, so that I feel engaged in the discovery process and can see progress as it happens.

**Why this priority**: Consistent with the existing tool invocation streaming pattern - users should see the playlist as it's being constructed, not wait for the entire response to complete.

**Independent Test**: Can be fully tested by asking for a playlist and observing the playlist card appears in the chat while the agent is still typing its response text.

**Acceptance Scenarios**:

1. **Given** I request a playlist from the agent, **When** the agent invokes the playlist suggestion tool, **Then** I see a "Building playlist..." indicator before the full playlist appears
2. **Given** the agent has invoked the tool, **When** the backend enriches the tracks with Tidal data, **Then** the playlist card updates to show the complete visual display
3. **Given** the agent generates a playlist, **When** I view the chat, **Then** the playlist appears inline at the exact position in the message where the agent created it
4. **Given** the agent continues typing after presenting the playlist, **When** I view the message, **Then** the subsequent text appears after the playlist card

---

### User Story 4 - Graceful Handling of Missing Track Data (Priority: P2)

As a music enthusiast, I want to still see the playlist even if some track data cannot be retrieved from Tidal, so that a partial enrichment failure doesn't prevent me from seeing the agent's recommendations.

**Why this priority**: Resilience is important but secondary to the core display functionality. The agent's recommendations have value even without artwork.

**Independent Test**: Can be fully tested by simulating a Tidal API failure for one track in a multi-track playlist and verifying the playlist still displays with available data.

**Acceptance Scenarios**:

1. **Given** the agent suggests 5 tracks, **When** 3 tracks are found on Tidal and 2 are not, **Then** the playlist displays all 5 tracks with available data (artwork for 3, fallback display for 2)
2. **Given** a track cannot be found on Tidal, **When** the playlist is displayed, **Then** that track shows the title and artist from the agent's input with a placeholder artwork
3. **Given** all tracks fail Tidal lookup, **When** the playlist is displayed, **Then** the playlist still renders using the agent-provided information (title, artist) without artwork
4. **Given** some tracks have incomplete data, **When** the user views the playlist, **Then** the track reasoning is still expandable and shows the agent's explanation

---

### User Story 5 - Historical Playlist Display (Priority: P2)

As a returning user viewing a previous conversation, I want to see the playlists the agent suggested in their full visual form, so that I can recall and reference past recommendations.

**Why this priority**: Important for user experience continuity but depends on core functionality being implemented first. Historical display uses persisted data.

**Independent Test**: Can be fully tested by generating a playlist in a conversation, closing the chat, reopening it, and verifying the playlist displays identically to when it was first created.

**Acceptance Scenarios**:

1. **Given** the agent previously suggested a playlist in a conversation, **When** I reload that conversation, **Then** the playlist displays with the same visual presentation as during the live session
2. **Given** a historical playlist is displayed, **When** I click on tracks, **Then** the reasoning expansion still functions correctly
3. **Given** a conversation contains multiple playlists, **When** I view the history, **Then** each playlist appears at its correct position in the conversation flow

---

### Edge Cases

- What happens when the agent suggests a playlist with 0 tracks? The system should not display an empty playlist card; the agent should only invoke the tool when it has at least 1 track to suggest.
- What happens when the agent provides an invalid ISRC format? The backend should validate ISRCs and skip invalid ones, displaying only tracks with valid ISRCs while logging the validation failure.
- What happens when the Tidal batch tracks API returns partial results? The playlist should display with available data; tracks not found should show the agent-provided title/artist with placeholder artwork.
- What happens when the Tidal albums API fails entirely? The playlist should still display using track data, with placeholder or missing artwork for all tracks.
- What happens when the agent suggests more than 50 tracks? The system should accept up to 50 tracks per playlist invocation; if more are provided, only the first 50 are processed with a warning logged.
- What happens when the same track appears multiple times in the playlist? Each instance should display as provided by the agent (duplicates are allowed if the agent chooses to include them).
- What happens when the SSE connection is lost while the playlist is being streamed? The user should see the last known state; on reconnection or page reload, the playlist displays from persisted data.
- What happens when a track's reasoning exceeds expected length? The reasoning should be displayed regardless of length, with natural text wrapping in the UI.

## Requirements *(mandatory)*

### Functional Requirements

#### Playlist Suggestion Tool

- **FR-001**: System MUST provide a playlist suggestion tool that the chat agent can invoke to present a curated playlist to the user
- **FR-002**: The tool input MUST include a playlist title and an array of tracks
- **FR-003**: Each track in the input MUST include: ISRC, title, artist name, and a reasoning sentence explaining why it was selected
- **FR-004**: System MUST validate ISRC format (ISO 3901: 12 alphanumeric characters) for each track before processing
- **FR-005**: System MUST accept between 1 and 50 tracks per playlist suggestion
- **FR-006**: System MUST reject tool invocations with 0 tracks

#### Track Enrichment

- **FR-007**: System MUST retrieve full track details from the Tidal batch tracks API using the provided ISRCs
- **FR-008**: System MUST retrieve album information including cover art URLs (160x160px size) for each track's album
- **FR-009**: System MUST handle partial Tidal API responses gracefully, enriching only the tracks that are found
- **FR-009a**: System MUST retry failed Tidal API calls once (after 1 second delay) before falling back to agent-provided data
- **FR-010**: System MUST include the original agent-provided title and artist for tracks not found in Tidal (after retry exhausted)
- **FR-011**: System MUST complete track enrichment within 5 seconds for playlists up to 20 tracks
- **FR-011a**: System SHOULD complete track enrichment within 10 seconds for playlists of 21-50 tracks (best effort due to Tidal API rate limits)

#### SSE Streaming Integration

- **FR-012**: System MUST stream the playlist suggestion to the frontend using the existing SSE event mechanism
- **FR-013**: System MUST emit a `tool_call_start` event when the playlist suggestion tool is invoked
- **FR-014**: System MUST emit a `tool_call_end` event when the enriched playlist data is ready, including full track and album details
- **FR-015**: The playlist data in the SSE event MUST include: playlist title, and for each track - ISRC, title, artist, album name, album artwork URL (if available), duration (if available), and reasoning text
- **FR-016**: System MUST handle Tidal API failures by emitting `tool_call_end` with available data rather than `tool_call_error`

#### Frontend Display

- **FR-017**: Frontend MUST display the playlist as a visually distinct card inline in the chat message
- **FR-018**: Frontend MUST display the playlist title prominently at the top of the card
- **FR-019**: Frontend MUST display each track with album artwork at 160x160px (or placeholder of same size), title, and artist name
- **FR-020**: Frontend MUST hide track reasoning by default
- **FR-021**: Frontend MUST expand track reasoning on click using an accordion-style interaction
- **FR-022**: Frontend MUST collapse any previously expanded track when a new track is expanded (single expansion mode)
- **FR-023**: Frontend MUST display a loading/building state while waiting for enriched data
- **FR-024**: Frontend MUST render the playlist at the correct position within the message content (inline with surrounding text)

#### Persistence

- **FR-025**: System MUST persist playlist tool invocations as content blocks in the message entity
- **FR-026**: System MUST store the enriched playlist data (not just the agent input) for historical display
- **FR-027**: System MUST reconstruct the visual playlist display from persisted content blocks when loading historical conversations

#### Observability

- **FR-028**: System MUST trace playlist tool invocations to the observability platform including: tool name, track count, ISRCs requested, enrichment success/failure counts, and execution duration
- **FR-029**: System MUST log validation failures (invalid ISRCs, empty playlists) for debugging

### Key Entities

- **Playlist Suggestion Input**: The data provided by the agent when invoking the tool. Includes playlist title and an array of track items, each containing ISRC, title, artist name, and reasoning text.
- **Enriched Playlist**: The complete playlist data after Tidal API enrichment. Includes playlist title and enriched track items with additional fields: album name, album artwork URL, track duration, and availability status.
- **Playlist Track Item**: A single track within the playlist. Contains both agent-provided data (ISRC, title, artist, reasoning) and enrichment data (album artwork, duration, Tidal availability).
- **Playlist Display State**: Frontend state for the playlist card UI. Includes tracks with their expanded/collapsed state for reasoning display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Playlist suggestions display with album artwork within 5 seconds of agent invocation for playlists of up to 20 tracks
- **SC-002**: 100% of playlist tracks show either Tidal artwork or a visible placeholder (no broken images)
- **SC-003**: Track reasoning expansion/collapse responds within 100ms of user click
- **SC-004**: Users can expand and view reasoning for any track in the playlist (100% of tracks have accessible reasoning)
- **SC-005**: Playlists display identically in live streaming and historical viewing modes
- **SC-006**: All playlist tool invocations are traced in the observability platform with complete metadata
- **SC-007**: System gracefully handles Tidal API failures - partial data displays without error states visible to users
- **SC-008**: Playlist SSE events stream to the interface within 500ms of track enrichment completion

## Assumptions

- The Tidal API batch tracks endpoint can accept multiple ISRCs in a single request (based on existing batch metadata patterns in feature 011)
- The Tidal API albums endpoint provides cover art URLs in a standard format suitable for frontend display
- The existing SSE streaming infrastructure from feature 010 can handle the enriched playlist payload size
- The agent has sufficient context to provide meaningful one-sentence reasoning for each track
- ISRCs provided by the agent are valid and correspond to tracks available in the Tidal catalogue (though the system handles misses gracefully)
- The frontend chat component can render custom card components inline within message text
- The observability infrastructure from feature 005 is available for tracing tool invocations

## Dependencies

- **specs/011-agent-tools**: Provides the tool invocation pattern, SSE event types, and agent integration framework that this feature extends
- **specs/010-discover-chat**: Provides the chat streaming infrastructure and message content block persistence
- **specs/001-tidal-search**: Provides Tidal API integration patterns for batch track and album lookups
- **specs/005-llm-observability**: Provides Langfuse tracing for tool invocation observability

## Scope Boundaries

### In Scope

- New agent tool for playlist suggestions with title and track reasoning
- Backend enrichment using Tidal batch tracks and albums APIs
- SSE streaming of enriched playlist data
- Frontend playlist card component with accordion-style reasoning
- Persistence of playlist data in message content blocks
- Historical playlist display reconstruction
- Observability tracing for playlist tool invocations

### Out of Scope

- Playlist persistence as a standalone entity (playlists are part of chat messages, not saved separately)
- Playlist playback functionality (playing tracks directly from the playlist card)
- Adding playlist tracks to user's Tidal library
- Playlist editing or reordering after generation
- Sharing playlists outside the chat context
- Playlist export to other music services
- Custom artwork or playlist cover image generation
