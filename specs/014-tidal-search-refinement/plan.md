# Implementation Plan: Tidal Search Tool Refinement

**Branch**: `014-tidal-search-refinement` | **Date**: 2025-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-tidal-search-refinement/spec.md`

## Summary

Refine the Tidal search tool and agent system prompt to clarify that Tidal search only supports text-based queries (artist/album/track names), not semantic/mood-based queries. Update tool descriptions and agent guidance so the agent correctly uses semantic search for mood queries (indexed library only) and leverages its own music knowledge to formulate artist/album queries for Tidal when expanding beyond the library.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend)
**Primary Dependencies**: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Zod 3.x
**Storage**: N/A (no storage changes)
**Testing**: Vitest 1.x (contract tests for tool descriptions, integration tests for agent behavior)
**Target Platform**: Node.js backend (GraphQL API + SSE streaming)
**Project Type**: Web application (backend changes only)
**Performance Goals**: No performance changes (documentation/prompt refinement only)
**Constraints**: Tool description changes must fit within Claude's context limits
**Scale/Scope**: Single file changes: `chatStreamService.ts` (tool descriptions), `chatSystemPrompt.ts` (agent guidance)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | Contract tests for tool descriptions, integration tests for agent behavior |
| II. Code Quality Standards | PASS | Minimal changes to existing code, clear documentation updates |
| III. User Experience Consistency | PASS | Improves UX by ensuring correct tool selection and transparent reasoning |
| IV. Robust Architecture | PASS | No architectural changes, only documentation/prompt refinement |
| V. Security by Design | N/A | No security-relevant changes |
| Development Workflow | PASS | Spec → Plan → Tasks workflow followed |

**Gate Status**: PASS - All applicable principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/014-tidal-search-refinement/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # N/A (no data model changes)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── prompts/
│   │   └── chatSystemPrompt.ts     # UPDATE: Agent behavior guidance
│   └── services/
│       └── chatStreamService.ts    # UPDATE: Tool descriptions
└── tests/
    ├── contract/
    │   └── toolDescriptions.test.ts  # NEW: Tool description validation
    └── integration/
        └── agentToolSelection.test.ts # NEW: Agent behavior validation
```

**Structure Decision**: Minimal changes to existing files. Only updating tool descriptions in `chatStreamService.ts` and agent guidance in `chatSystemPrompt.ts`. Adding tests to verify tool description clarity and agent behavior.

## Complexity Tracking

No violations - this feature involves minimal changes:
- 2 file updates (tool descriptions + system prompt)
- 2 new test files (contract + integration)
- No new abstractions or patterns

## Phase 0: Research

### Research Tasks

1. **Tool Description Best Practices**: How to write clear, actionable tool descriptions for LLM agents
2. **Agent Prompt Engineering**: Best practices for guiding agent tool selection behavior
3. **Existing Implementation Review**: Current tool descriptions and system prompt structure

### Findings

See [research.md](./research.md) for detailed findings.

## Phase 1: Design

### Tool Description Updates

**Current Tidal Search Description** (line 324 of `chatStreamService.ts`):
```typescript
description: 'Search the Tidal music catalogue for tracks, albums, or artists. Returns results with library status (whether already in user\'s library) and index status (whether fully analyzed).',
```

**Updated Tidal Search Description**:
```typescript
description: 'Search the Tidal music catalogue by artist name, album name, or track title. IMPORTANT: This tool only supports text-based keyword search - it does NOT understand mood, theme, or semantic queries. For mood-based requests, use semanticSearch first, then use this tool with specific artist/album names you know match the mood. Returns results with library and index status flags.',
```

**Current Semantic Search Description** (line 230):
```typescript
description: 'Search indexed tracks in user\'s library by mood, theme, or lyrics description. Returns tracks with full metadata including lyrics interpretation and audio features.',
```

**Updated Semantic Search Description**:
```typescript
description: 'Search the user\'s indexed library by lyrical themes and interpreted meaning. IMPORTANT: This tool matches based on LYRICS INTERPRETATION, not musical style or audio features. A query like "ambient music" will find tracks with ambient themes in lyrics, NOT necessarily ambient-sounding music. For style/genre recommendations, use your music knowledge with tidalSearch instead. Results include shortDescription for each track.',
```

### System Prompt Updates

Add new section to `chatSystemPrompt.ts` after the tool descriptions:

```typescript
## Tool Selection Strategy

### Understanding Tool Capabilities

**semanticSearch** searches the user's indexed library using lyrics interpretation embeddings:
- "songs about heartbreak and loss" ✓ (matches lyrical themes)
- "tracks about hope and new beginnings" ✓ (matches interpreted meaning)
- BUT: Only searches the indexed library
- NOTE: Matches based on LYRICS INTERPRETATION, not musical style. "ambient music" will NOT reliably find ambient-sounding tracks - it will find tracks with lyrics interpreted as ambient/atmospheric themes.

For musical style recommendations (genres, sounds, vibes), use YOUR music knowledge + tidalSearch.

**tidalSearch** ONLY understands text keywords (artist/album/track names):
- "Radiohead" ✓
- "OK Computer" ✓
- "Creep" ✓
- "melancholic rock" ✗ (will NOT find mood-matching results)

### When to Use Each Tool

1. **User asks for mood/theme ("I want energetic workout music")**:
   - First: Use semanticSearch to find matches in their indexed library
   - ALWAYS ALSO: Use YOUR music knowledge to identify artists that match the mood
   - Then: Use tidalSearch with those specific artist/album names
   - Note: semanticSearch always returns results (RRF scoring has no cutoff), so you cannot judge relevance by result count - always augment with Tidal searches

2. **User asks for artist/album/track ("Play something by Radiohead")**:
   - Directly use tidalSearch with the artist/album/track name
   - Skip semanticSearch (user wants specific artist, not mood-based discovery)

3. **User asks for genre exploration ("What jazz albums are popular?")**:
   - Use YOUR music knowledge to suggest specific artists/albums
   - Use tidalSearch with those specific names

### Using Your Music Knowledge

You have extensive knowledge of music across all genres. For EVERY mood-based request, leverage this knowledge to:

1. Identify artists/albums that match the user's mood request
2. Formulate specific tidalSearch queries using those names
3. Explain to the user why you suggested those artists

**CRITICAL**: Always augment semantic search with Tidal searches. The semantic search results may include low-relevance tracks (the hybrid scoring always returns results), so your music knowledge is essential for providing high-quality recommendations.

Example workflow for "I want dreamy ambient music":
1. semanticSearch("dreamy ambient") → Returns tracks (relevance varies)
2. Think: "Dreamy ambient... Brian Eno, Aphex Twin's ambient works, Stars of the Lid..."
3. tidalSearch("Brian Eno Ambient") → Found albums
4. tidalSearch("Stars of the Lid") → Found albums
5. Present results: "From your library, I found some tracks that may match. I also searched for Brian Eno and Stars of the Lid, masters of the ambient genre, to give you more options..."
```

### Test Design

**Contract Tests** (`tests/contract/toolDescriptions.test.ts`):
- Verify Tidal search description contains "text-based" or "keyword"
- Verify Tidal search description contains warning about mood queries
- Verify semantic search description clarifies library-only scope
- Verify system prompt contains tool selection guidance

**Integration Tests** (`tests/integration/agentToolSelection.test.ts`):
- Mock LLM to verify correct tool selection based on query type
- Verify agent uses music knowledge for Tidal queries (not passing mood text)

See [quickstart.md](./quickstart.md) for testing instructions.
