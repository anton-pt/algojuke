# Quickstart: Tidal Search Tool Refinement

**Feature**: 014-tidal-search-refinement
**Date**: 2025-01-02

## Overview

This feature refines tool descriptions and agent guidance to ensure correct tool selection for music discovery queries. The changes are purely documentation/prompt changes - no new functionality.

## Prerequisites

- Node.js 20.x
- Backend dependencies installed (`cd backend && npm install`)
- No external services required for testing

## Files Modified

| File | Change |
|------|--------|
| `backend/src/services/chatStreamService.ts` | Updated tool descriptions (lines 230, 324) |
| `backend/src/prompts/chatSystemPrompt.ts` | Added Tool Selection Strategy section |

## Files Created

| File | Purpose |
|------|---------|
| `backend/tests/contract/toolDescriptions.test.ts` | Validates tool description content |
| `backend/tests/integration/agentToolSelection.test.ts` | Validates agent behavior (mocked) |

## Running Tests

```bash
# From repository root
cd backend

# Run all tests
npm test

# Run only this feature's tests
npm test -- tests/contract/toolDescriptions.test.ts
npm test -- tests/integration/agentToolSelection.test.ts

# Run with verbose output
npm test -- --reporter=verbose tests/contract/toolDescriptions.test.ts
```

## Validation Checklist

### Tool Description Validation

- [x] Tidal search description contains "text-based" or "keyword"
- [x] Tidal search description contains "does NOT" warning about mood queries
- [x] Semantic search description contains "indexed library" scope clarification
- [x] Semantic search description clarifies it matches "lyrics interpretation" not musical style
- [x] Semantic search description mentions shortDescription

### System Prompt Validation

- [x] Contains "Tool Selection Strategy" section
- [x] Contains decision tree for mood vs name queries
- [x] Contains worked example showing knowledge-driven search
- [x] Contains guidance for using music knowledge

### Behavioral Validation (requires manual testing)

- [x] Agent ALWAYS uses both semanticSearch AND tidalSearch for mood/theme queries
- [x] Agent uses tidalSearch directly for artist/album queries (skips semanticSearch)
- [x] Agent formulates artist names (not mood text) for Tidal queries
- [x] Agent uses music knowledge for style/genre queries (not relying on semantic search)
- [x] Agent explains reasoning when using music knowledge

## Manual Testing

To manually verify agent behavior:

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open the chat interface and test these queries:

   **Mood query** (should use semanticSearch AND tidalSearch):
   ```
   Find me some melancholic songs about lost love
   ```
   Expected: Agent uses semanticSearch AND tidalSearch with specific artist names (e.g., "Bon Iver", "Elliott Smith", "Phoebe Bridgers")

   **Artist query** (should use tidalSearch directly):
   ```
   What albums does Radiohead have?
   ```
   Expected: Agent uses tidalSearch directly with "Radiohead" (no semanticSearch needed)

   **Genre exploration** (should use music knowledge):
   ```
   I want dreamy ambient music
   ```
   Expected: Agent uses semanticSearch AND tidalSearch with artist names like "Brian Eno", "Stars of the Lid"

4. Verify in chat that:
   - For mood queries: BOTH semanticSearch AND tidalSearch are used
   - Tool invocations appear in correct order
   - Agent explains its reasoning when using music knowledge
   - Results are labeled (library vs Tidal catalogue)

## Troubleshooting

### Agent still passes mood text to Tidal search

- Verify `chatStreamService.ts` has updated tool description
- Check that description includes "does NOT understand mood"
- Restart the backend to pick up changes

### Agent only uses semanticSearch for mood queries (doesn't augment with Tidal)

- Verify `chatSystemPrompt.ts` includes "ALWAYS ALSO" and "CRITICAL" guidance
- Check that the system prompt emphasizes agent must always augment with Tidal searches
- The agent should never rely on semantic search alone for mood queries

### Tests fail to find expected phrases

- Check exact wording in tool descriptions
- Update test assertions if wording changed

### Agent doesn't explain reasoning

- Verify `chatSystemPrompt.ts` includes the Tool Selection Strategy section
- Check that the example workflow is present
