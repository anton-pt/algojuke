# Research: Tidal Search Tool Refinement

**Feature**: 014-tidal-search-refinement
**Date**: 2025-01-02

## Research Tasks

1. Tool description best practices for LLM agents
2. Agent prompt engineering for tool selection
3. Existing implementation review

---

## 1. Tool Description Best Practices

### Decision: Use explicit capability statements and negative examples

### Rationale

LLM agents interpret tool descriptions literally. Effective tool descriptions should:

1. **State capabilities explicitly**: "searches by artist name, album name, or track title"
2. **State limitations explicitly**: "does NOT understand mood or semantic queries"
3. **Provide usage guidance**: "For mood-based requests, use semanticSearch first"
4. **Keep descriptions concise**: Avoid overwhelming the context window

Research from Anthropic's tool use documentation and OpenAI's function calling best practices confirms that explicit negative constraints ("does NOT") are more effective than implicit assumptions.

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Longer prose descriptions | Increases token usage, harder for agent to parse |
| Separate guidance document | Agent can't access external docs during tool selection |
| Rename tools (e.g., `tidalKeywordSearch`) | Breaking change, requires schema updates |

---

## 2. Agent Prompt Engineering for Tool Selection

### Decision: Add structured "Tool Selection Strategy" section to system prompt

### Rationale

The system prompt is the most reliable place to encode behavioral guidance because:

1. **Always available**: System prompt is included in every LLM call
2. **Takes precedence**: Claude weights system prompt highly for behavioral instructions
3. **Structured format**: Using headers and examples improves comprehension

Key patterns from effective agent prompts:
- **Decision trees**: "If X, then use tool Y"
- **Worked examples**: Show the reasoning process, not just the answer
- **Explicit knowledge invocation**: "Use YOUR music knowledge to..."

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Fine-tuning | Not available for Claude, overkill for this use case |
| Few-shot examples in conversation | Increases token cost per request |
| Tool-level system prompts | Not supported by Vercel AI SDK |

---

## 3. Existing Implementation Review

### Decision: Minimal changes to existing code structure

### Rationale

Current implementation is well-structured:

**chatStreamService.ts**:
- Tool definitions use Vercel AI SDK `tool()` helper
- Each tool has a `description` field that can be updated
- No structural changes needed

**chatSystemPrompt.ts**:
- Single exported constant `CHAT_SYSTEM_PROMPT`
- Already has sections for tool descriptions and workflow guidelines
- Can add new "Tool Selection Strategy" section without restructuring

**Key insight from code review**:
- Tidal search tool description (line 324) is generic: "Search the Tidal music catalogue for tracks, albums, or artists"
- This doesn't communicate the text-only constraint
- Agent may incorrectly pass mood queries to this tool

**Semantic search description** (line 230):
- Describes mood/theme capability but doesn't emphasize library-only scope
- Agent may not realize it can't discover new tracks

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `chatStreamService.ts` | UPDATE | Lines 230, 324 - tool descriptions |
| `chatSystemPrompt.ts` | UPDATE | Add Tool Selection Strategy section |

### New Test Files

| File | Purpose |
|------|---------|
| `tests/contract/toolDescriptions.test.ts` | Verify tool description content |
| `tests/integration/agentToolSelection.test.ts` | Verify agent behavior (mocked) |

---

## 4. RRF Hybrid Search Behavior

### Decision: Agent must ALWAYS augment semantic search with Tidal searches

### Rationale

The semantic search uses RRF (Reciprocal Rank Fusion) hybrid scoring which always returns results - there is no natural score cutoff to determine relevance. This means:

1. **Cannot judge by result count**: Semantic search will return N results regardless of query match quality
2. **Cannot judge by score**: RRF scores don't have an intuitive "good/bad" threshold
3. **Agent must always augment**: For mood-based queries, the agent should ALWAYS use its music knowledge to formulate Tidal searches, not conditionally based on semantic search result count

This is a key behavioral requirement that differs from typical search patterns where "no results" is a clear signal.

---

## 5. Semantic Search Matches Lyrics, Not Musical Style

### Decision: Clarify that semantic search works on lyrics interpretation, not audio characteristics

### Rationale

The semantic search uses:
- **Embedding vectors** from the AI-generated lyrics interpretation
- **BM25 keyword search** on the interpretation text

This means semantic search matches **thematic/lyrical content**, NOT:
- Musical style (ambient, jazz, rock)
- Audio features (tempo, energy, acousticness)
- Genre classifications

**Example impact**:
- Query "ambient music" → Will find tracks with lyrics interpreted as atmospheric/ambient themes, NOT necessarily ambient-sounding music
- Query "songs about loss" → Will correctly find tracks with loss themes in lyrics

**Agent guidance**: For style/genre recommendations, the agent MUST use its own music knowledge to identify appropriate artists/albums, then search Tidal. Semantic search is best for lyrical theme queries.

---

## Summary

All research tasks resolved. The implementation approach is:

1. **Update tool descriptions** in `chatStreamService.ts` to explicitly state capabilities and limitations
2. **Add Tool Selection Strategy** to `chatSystemPrompt.ts` with decision trees and worked examples
3. **Emphasize "always augment"** behavior - agent must always combine semantic search with Tidal searches for mood queries
4. **Clarify lyrics vs style** - semantic search matches lyrical themes, not musical style; agent must use its knowledge for style recommendations
5. **Add contract tests** to verify description content contains required phrases
6. **Add integration tests** to verify agent behavior with mocked LLM responses

No NEEDS CLARIFICATION items remain.
