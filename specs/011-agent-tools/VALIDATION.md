# Agent Tools Validation Checklist

**Feature**: 011-agent-tools
**Date**: 2025-01-02
**Status**: Ready for validation

## Prerequisites

- [ ] Backend server running (`npm run dev` in `/backend`)
- [ ] Qdrant running with indexed tracks (`docker compose up qdrant -d`)
- [ ] PostgreSQL running with library data (`docker compose up db -d`)
- [ ] Frontend running (`npm run dev` in `/frontend`)
- [ ] Valid Tidal API credentials configured
- [ ] Valid Anthropic API key configured

## Semantic Library Search Tool (FR-001 to FR-006)

### Basic Functionality
- [ ] Agent can invoke semantic search with a natural language query
- [ ] Search results are ranked by relevance score
- [ ] Each result includes: title, artist, album, ISRC
- [ ] Each result includes lyrics (when available)
- [ ] Each result includes interpretation (when available)
- [ ] Each result includes audio features (when available)
- [ ] Each result includes `inLibrary` boolean flag
- [ ] Default limit of 20 results is respected
- [ ] Custom limit up to 50 works correctly
- [ ] Empty result sets return empty array without error

### Test Queries
- [ ] "Find melancholic songs about lost love" returns relevant tracks
- [ ] "Upbeat dance music" returns high-energy tracks
- [ ] "Acoustic guitar songs" returns acoustic tracks
- [ ] Query with no matches returns empty results gracefully

## Tidal Catalogue Search Tool (FR-007 to FR-015)

### Basic Functionality
- [ ] Agent can search for tracks by text query
- [ ] Agent can search for albums by text query
- [ ] Agent can search for both tracks and albums
- [ ] Track results include: title, artist, album, duration, ISRC, artwork URL
- [ ] Album results include: title, artist, artwork URL, release date, track count
- [ ] Track results include `inLibrary` boolean flag
- [ ] Track results include `isIndexed` boolean flag
- [ ] Album results include `inLibrary` boolean flag
- [ ] Default limit of 20 results is respected
- [ ] Custom limit up to 100 works correctly
- [ ] Empty result sets return empty array without error

### Album Tracks
- [ ] `albumTracks` tool retrieves all tracks for an album by ID
- [ ] Each track includes library and indexing status

### Test Queries
- [ ] "Radiohead" returns matching artists/albums/tracks
- [ ] Search for a known album shows track listing capability
- [ ] Library tracks show `inLibrary: true`
- [ ] Indexed tracks show `isIndexed: true`

## Batch Metadata Retrieval Tool (FR-016 to FR-021)

### Basic Functionality
- [ ] Agent can request metadata for a list of ISRCs
- [ ] Found tracks include full metadata (title, artist, album, lyrics, interpretation, audio features)
- [ ] Response clearly indicates which ISRCs were found
- [ ] Response clearly indicates which ISRCs were not found
- [ ] Batch of up to 100 ISRCs succeeds
- [ ] Batch exceeding 100 ISRCs is rejected with clear error

### ISRC Validation
- [ ] Valid 12-character alphanumeric ISRCs are accepted
- [ ] Invalid ISRC formats are rejected with validation error
- [ ] ISRCs are normalized to uppercase

### Test Cases
- [ ] Empty ISRC list returns empty result without error
- [ ] Mix of found and not-found ISRCs returns partial results
- [ ] Single valid ISRC returns complete metadata

## Tool Integration (FR-022 to FR-026, FR-033)

### Agent Integration
- [ ] Tools are available in agent tool registry
- [ ] Agent can select appropriate tool based on user request
- [ ] Agent receives structured responses suitable for processing
- [ ] Agent can reference previous tool results in conversation

### Error Handling
- [ ] Transient failures trigger automatic retry (once)
- [ ] After retry failure, clear error is returned to agent
- [ ] Service unavailability returns descriptive error
- [ ] Agent can suggest alternative approaches on failure

### Observability
- [ ] Tool invocations create Langfuse spans
- [ ] Spans include: tool name, input parameters, duration
- [ ] Spans include output (result count for display)
- [ ] Failed invocations include error details

## Tool Invocation Streaming (FR-027 to FR-032, FR-034)

### Real-time Updates
- [ ] Tool invocation events stream to UI within 500ms
- [ ] "Pending" status shows before execution begins
- [ ] "Running" status shows during execution
- [ ] "Completed" status shows when done
- [ ] "Failed" status shows on error

### Display
- [ ] Tool name is displayed (e.g., "Semantic Search", "Tidal Search")
- [ ] Tool parameters are visible (query text, limits)
- [ ] Result summary shows count (e.g., "Found 15 tracks")
- [ ] Results are expandable to show full details
- [ ] Failed tools show error message

### Integration
- [ ] Tool events integrate with existing chat streaming
- [ ] Multiple sequential tool calls display correctly
- [ ] Text and tool invocations interleave correctly

## Success Criteria Validation

### Performance (SC-001 to SC-003)
- [ ] Semantic search completes within 3 seconds
- [ ] Tidal search completes within 3 seconds
- [ ] Batch metadata (100 ISRCs) completes within 2 seconds

### Accuracy (SC-004 to SC-006)
- [ ] 100% of semantic results have correct library status
- [ ] 100% of Tidal results have correct library/indexing status
- [ ] All tool invocations appear in Langfuse traces

### User Experience (SC-007 to SC-010)
- [ ] Agent combines tools for complex requests
- [ ] Clear feedback on tool failures
- [ ] Tool events visible within 500ms
- [ ] 100% of tool invocations are visible in UI

## Edge Cases

- [ ] Vector index unavailable: Agent suggests Tidal search
- [ ] Tidal API unavailable: Agent suggests semantic search
- [ ] Track exists in Tidal but not indexed: Shows "not indexed" flag
- [ ] Indexed track removed from library: `inLibrary` reflects current state
- [ ] Common query with many results: Respects configured limits
- [ ] Streaming interrupted: Shows last known state gracefully

## Sign-off

| Validator | Date | Status |
|-----------|------|--------|
| | | |
