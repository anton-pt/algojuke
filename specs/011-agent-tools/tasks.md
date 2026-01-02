# Implementation Tasks: Agent Tools for Discover Chat

**Feature**: 011-agent-tools
**Generated**: 2025-12-31
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 0: Setup

### Task 0.1: Create feature branch and directory structure
**Priority**: P0 | **Estimate**: S
**Files**:
- `backend/src/services/agentTools/` (create directory)
- `backend/src/schemas/agentTools.ts` (create file)
- `backend/src/types/agentTools.ts` (create file)
- `backend/tests/contract/agentTools/` (create directory)
- `backend/tests/integration/agentTools/` (create directory)
- `frontend/src/components/chat/ToolInvocation.tsx` (create file)
- `frontend/tests/components/chat/ToolInvocation.test.tsx` (create file)

**Acceptance**:
- [x] Feature branch `011-agent-tools` exists
- [x] All directories and placeholder files created
- [x] TypeScript compiles without errors

---

## Phase 1: Foundational (Shared Types & Schemas)

### Task 1.1: Define Zod schemas for tool inputs
**Priority**: P0 | **Estimate**: S
**Prereqs**: Task 0.1
**Files**:
- `backend/src/schemas/agentTools.ts`

**Requirements**: FR-005, FR-014, FR-020, FR-017

**Implementation**:
```typescript
// Schemas for:
// - SemanticSearchInputSchema (query: string, limit: 1-50 default 20)
// - TidalSearchInputSchema (query: string, searchType: enum, limit: 1-100 default 20)
// - BatchMetadataInputSchema (isrcs: string[] 0-100, ISRC regex validation)
// - AlbumTracksInputSchema (albumId: string)
```

**Acceptance**:
- [x] All input schemas defined with proper validation rules
- [x] ISRC format validation regex: `/^[A-Z0-9]{12}$/i`
- [x] Empty ISRC array returns empty result (per US3 acceptance scenario 4)
- [x] Default values for optional fields
- [x] Contract tests for schema validation pass

**Contract Tests**:
- `backend/tests/contract/agentTools/schemas.test.ts`

---

### Task 1.2: Define TypeScript types for tool outputs
**Priority**: P0 | **Estimate**: S
**Prereqs**: Task 0.1
**Files**:
- `backend/src/types/agentTools.ts`

**Requirements**: FR-003, FR-012, FR-013, FR-018, FR-019

**Implementation**:
Per `data-model.md`:
- `TrackResult`, `IndexedTrackResult`, `AlbumResult`
- `SemanticSearchOutput`, `TidalSearchOutput`, `BatchMetadataOutput`, `AlbumTracksOutput`
- `ToolInput`, `ToolOutput` union types

**Acceptance**:
- [x] All output types match data-model.md specifications
- [x] All tool outputs follow consistent structure: `{ ...result, summary: string, durationMs: number }`
- [x] Exported from types/agentTools.ts
- [x] TypeScript compiles without errors

---

### Task 1.3: Extend SSE event types for tool invocations
**Priority**: P0 | **Estimate**: S
**Prereqs**: Task 1.2
**Files**:
- `backend/src/services/chatStreamService.ts` (extend SSEEventType)
- `frontend/src/types/chat.ts` (extend SSEEvent union)

**Requirements**: FR-027, FR-028, FR-029

**Implementation**:
Per `contracts/sse-tool-events.md`:
- `ToolCallStartEvent { type, toolCallId, toolName, input }`
- `ToolCallEndEvent { type, toolCallId, summary, resultCount, durationMs, output? }`
- `ToolCallErrorEvent { type, toolCallId, error, retryable, wasRetried }`

**Acceptance**:
- [x] Event types defined in backend
- [x] Event types mirrored in frontend
- [x] Type union updated: `SSEEvent = ... | ToolCallStartEvent | ...`

---

## Phase 2: US1 - Semantic Music Discovery (P1)

### Task 2.1: Implement semanticSearchTool
**Priority**: P1 | **Estimate**: M
**Prereqs**: Task 1.1, Task 1.2
**Files**:
- `backend/src/services/agentTools/semanticSearchTool.ts`
- `backend/src/services/agentTools/index.ts`

**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006

**Implementation**:
Per `contracts/semantic-search-tool.md`:
1. Validate input with SemanticSearchInputSchema
2. Use existing `searchService.searchByQuery()` from 009-semantic-discovery-search
3. Enrich results with library status via `libraryService.getTracksByIsrcs()`
4. Build response with summary: "Found N tracks matching 'query'"
5. Return `SemanticSearchOutput`

**Acceptance**:
- [x] Tool searches vector index via existing search service
- [x] Results include all metadata fields (lyrics, interpretation, audioFeatures)
- [x] Every result has accurate `inLibrary` flag
- [x] Empty results return `tracks: []` without error
- [x] Integration tests pass

**Contract Tests**:
- `backend/tests/contract/agentTools/semanticSearchTool.test.ts`

**Integration Tests**:
- `backend/tests/integration/agentTools/semanticSearchTool.test.ts`

---

### Task 2.2: Add retry logic wrapper for tool execution
**Priority**: P1 | **Estimate**: S
**Prereqs**: Task 2.1
**Files**:
- `backend/src/services/agentTools/retry.ts`

**Requirements**: FR-033

**Implementation**:
Per `research.md` Section 5:
```typescript
const executeWithRetry = async <T>(fn: () => Promise<T>, toolName: string): Promise<T>
// Retry on: ECONNREFUSED, ETIMEDOUT, ENOTFOUND, HTTP 429/503/504
// No retry on: validation errors, HTTP 400/401/403/404
// Single retry with 1000ms delay
```

**Acceptance**:
- [x] Transient errors trigger single retry after 1s
- [x] Validation errors do not retry
- [x] `wasRetried` flag tracked for error events
- [x] Non-retryable errors return meaningful messages (e.g., "Vector search service unavailable")
- [x] Error responses include `retryable` flag for frontend guidance
- [x] Graceful degradation: semantic search failure suggests Tidal search alternative
- [x] Contract tests for retry behavior pass

---

### Task 2.3: Add Langfuse tracing for tool invocations
**Priority**: P1 | **Estimate**: S
**Prereqs**: Task 2.1
**Files**:
- `backend/src/services/agentTools/tracing.ts`

**Requirements**: FR-024

**Implementation**:
Per `research.md` Section 7:
- `executeToolWithTracing(trace, toolName, input, fn)`
- Create span under chat generation trace
- Record input, output, durationMs
- Handle errors with ERROR level

**Acceptance**:
- [x] Each tool invocation creates a Langfuse span
- [x] Span includes input parameters
- [x] Span includes output or error
- [x] Duration recorded in metadata

---

## Phase 3: US2 - Catalogue Exploration (P1)

### Task 3.1: Implement tidalSearchTool
**Priority**: P1 | **Estimate**: M
**Prereqs**: Task 1.1, Task 1.2, Task 2.2
**Files**:
- `backend/src/services/agentTools/tidalSearchTool.ts`

**Requirements**: FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014

**Implementation**:
Per `contracts/tidal-search-tool.md`:
1. Validate input with TidalSearchInputSchema
2. Call existing `tidalService.search()` from 001-tidal-search
3. Enrich track results with library status and index status
4. Enrich album results with library status
5. Build response with summary

**Index Status Check**:
```typescript
// Check if track exists in Qdrant by ISRC
const checkIndexStatus = async (isrcs: string[]) => {
  // Batch check against Qdrant collection
}
```

**Acceptance**:
- [x] Supports searchType: 'tracks' | 'albums' | 'both'
- [x] Track results include `inLibrary` and `isIndexed` flags
- [x] Album results include `inLibrary` flag
- [x] Respects limit parameter (default 20, max 100)
- [x] Integration tests pass

**Contract Tests**:
- `backend/tests/contract/agentTools/tidalSearchTool.test.ts`

**Integration Tests**:
- `backend/tests/integration/agentTools/tidalSearchTool.test.ts`

---

### Task 3.2: Implement albumTracksTool
**Priority**: P1 | **Estimate**: S
**Prereqs**: Task 3.1
**Files**:
- `backend/src/services/agentTools/albumTracksTool.ts`

**Requirements**: FR-015

**Implementation**:
Per `contracts/tidal-search-tool.md` (Related Tool section):
1. Validate albumId
2. Call `tidalService.getAlbumTracks(albumId)`
3. Enrich tracks with library and index status
4. Return `AlbumTracksOutput`

**Acceptance**:
- [x] Returns all tracks for album
- [x] Each track has `inLibrary` and `isIndexed` flags
- [x] Summary format: "Album has N tracks"
- [x] Contract tests pass

---

## Phase 4: US5 - Transparent Agent Workflow (P1)

### Task 4.1: Integrate tools into chatStreamService with SSE streaming
**Priority**: P1 | **Estimate**: L
**Prereqs**: Task 2.1, Task 3.1, Task 3.2, Task 1.3
**Files**:
- `backend/src/services/chatStreamService.ts`

**Requirements**: FR-022, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032

**Implementation**:
Per `research.md` Section 1:
```typescript
import { streamText, tool } from 'ai';

const tools = {
  semanticSearch: tool({
    description: '...',
    parameters: SemanticSearchInputSchema,
    execute: async (input) => semanticSearchTool.execute(input),
  }),
  tidalSearch: tool({ ... }),
  albumTracks: tool({ ... }),
  // batchMetadata added in Task 5.2
};

const result = streamText({
  model,
  system: SYSTEM_PROMPT,
  messages,
  tools,
  maxSteps: 20,
  onStepFinish: ({ stepType, toolCalls, toolResults }) => {
    // Emit tool_call_start, tool_call_end, or tool_call_error
  },
});
```

**SSE Event Emission**:
- Emit `tool_call_start` when tool execution begins
- Emit `tool_call_end` with summary when tool completes
- Emit `tool_call_error` if tool fails (after retry if applicable)

**Acceptance**:
- [x] Tools registered with Vercel AI SDK
- [x] `maxSteps: 20` allows complex multi-tool workflows
- [x] SSE events streamed in real-time
- [x] Tool events interleaved with text_delta events correctly
- [x] Integration tests pass

**Integration Tests**:
- `backend/tests/integration/agentTools/chatStreamService.test.ts`

---

### Task 4.2: Persist tool invocations to Message content blocks
**Priority**: P1 | **Estimate**: M
**Prereqs**: Task 4.1
**Files**:
- `backend/src/services/chatStreamService.ts`

**Requirements**: FR-026

**Implementation**:
Per `research.md` Section 3:
- Collect all content blocks during streaming (text, tool_use, tool_result)
- Save complete `content` array to Message entity on message_end
- ContentBlock types already support `tool_use` and `tool_result`

**Message Structure**:
```typescript
{
  role: 'assistant',
  content: [
    { type: 'text', text: '...' },
    { type: 'tool_use', id: 'tc_1', name: 'semanticSearch', input: {...} },
    { type: 'tool_result', tool_use_id: 'tc_1', content: {...} },
    { type: 'text', text: '...' },
  ]
}
```

**Acceptance**:
- [x] Tool calls saved as `tool_use` blocks
- [x] Tool results saved as `tool_result` blocks
- [x] Order preserved (text -> tool_use -> tool_result -> text)
- [x] Historical messages load correctly with all blocks
- [x] Integration tests pass

---

### Task 4.3: Create ToolInvocation frontend component
**Priority**: P1 | **Estimate**: M
**Prereqs**: Task 1.3
**Files**:
- `frontend/src/components/chat/ToolInvocation.tsx`
- `frontend/src/components/chat/ToolInvocation.css`

**Requirements**: FR-030, FR-034

**Implementation**:
Per `research.md` Section 6:
- Expandable card component
- Shows tool name with icon
- Shows status badge (executing/completed/failed)
- Shows summary when completed
- Expands to show full results on click

**Props**:
```typescript
interface ToolInvocationProps {
  toolCallId: string;
  toolName: string;
  input: unknown;
  status: 'executing' | 'completed' | 'failed';
  summary?: string;
  resultCount?: number;
  output?: unknown;
  error?: string;
  durationMs?: number;
}
```

**Acceptance**:
- [x] Shows "Searching..." with spinner during execution
- [x] Shows summary and result count on completion
- [x] Expandable to show full results
- [x] Shows error message on failure
- [x] Component tests pass

**Component Tests**:
- `frontend/tests/components/chat/ToolInvocation.test.tsx`

---

### Task 4.4: Extend useChatStream hook for tool events
**Priority**: P1 | **Estimate**: M
**Prereqs**: Task 4.1, Task 4.3
**Files**:
- `frontend/src/hooks/useChatStream.ts`
- `frontend/src/types/chat.ts`

**Requirements**: FR-027, FR-028, FR-029

**Implementation**:
Per `contracts/sse-tool-events.md` (Frontend Handling):
```typescript
const [toolInvocations, setToolInvocations] = useState<Map<string, ToolInvocationState>>();

// Handle tool events
case 'tool_call_start':
  setToolInvocations(prev => new Map(prev).set(event.toolCallId, {
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    input: event.input,
    status: 'executing',
    expanded: false,
  }));
  break;

case 'tool_call_end':
  // Update status to 'completed', add summary/output
  break;

case 'tool_call_error':
  // Update status to 'failed', add error
  break;
```

**Acceptance**:
- [x] Tool events parsed from SSE stream
- [x] Tool invocation state tracked by toolCallId
- [x] State updates trigger re-render
- [x] Hook returns toolInvocations for rendering

---

### Task 4.5: Integrate ToolInvocation into ChatMessage
**Priority**: P1 | **Estimate**: S
**Prereqs**: Task 4.3, Task 4.4
**Files**:
- `frontend/src/components/chat/ChatMessage.tsx`

**Requirements**: FR-031

**Implementation**:
Per `contracts/sse-tool-events.md` (Rendering in Chat Message):
- Render tool invocations inline within message
- Position based on content block order
- Handle both streaming (from hook) and historical (from content blocks)

```tsx
const ChatMessage = ({ content, toolInvocations }) => {
  return (
    <div className="message">
      {content.map((block, i) => {
        if (block.type === 'text') return <Markdown key={i}>{block.text}</Markdown>;
        if (block.type === 'tool_use') {
          const invocation = toolInvocations.get(block.id);
          return <ToolInvocation key={i} {...invocation} />;
        }
        return null;
      })}
    </div>
  );
};
```

**Acceptance**:
- [x] Tool invocations render inline in messages
- [x] Correct order: text before tool, tool before result, result before next text
- [x] Works for streaming messages
- [x] Works for historical messages loaded from DB

---

## Phase 5: US3 - Batch Metadata Retrieval (P2)

### Task 5.1: Implement batchMetadataTool
**Priority**: P2 | **Estimate**: M
**Prereqs**: Task 1.1, Task 1.2, Task 2.2
**Files**:
- `backend/src/services/agentTools/batchMetadataTool.ts`

**Requirements**: FR-016, FR-017, FR-018, FR-019, FR-020, FR-021

**Implementation**:
Per `contracts/batch-metadata-tool.md`:
1. Validate input (1-100 ISRCs, format validation)
2. Batch query Qdrant by ISRCs
3. Enrich with library status
4. Categorize found vs. notFound ISRCs
5. Return `BatchMetadataOutput`

**ISRC Validation**:
- Format: 12 alphanumeric characters
- Invalid ISRCs silently added to `notFound`

**Acceptance**:
- [x] Validates ISRC format
- [x] Rejects requests > 100 ISRCs with error
- [x] Returns partial results (found + notFound)
- [x] Full metadata for indexed tracks
- [x] Integration tests pass

**Contract Tests**:
- `backend/tests/contract/agentTools/batchMetadataTool.test.ts`

**Integration Tests**:
- `backend/tests/integration/agentTools/batchMetadataTool.test.ts`

---

### Task 5.2: Register batchMetadataTool with agent
**Priority**: P2 | **Estimate**: S
**Prereqs**: Task 5.1, Task 4.1
**Files**:
- `backend/src/services/chatStreamService.ts`

**Requirements**: FR-022

**Implementation**:
Add to tools object in chatStreamService:
```typescript
batchMetadata: tool({
  description: 'Retrieve full metadata for multiple tracks by ISRC...',
  parameters: BatchMetadataInputSchema,
  execute: async (input) => batchMetadataTool.execute(input),
}),
```

**Acceptance**:
- [x] Tool available to agent
- [x] Agent can invoke for multi-track lookups
- [x] Follows same SSE streaming pattern

---

## Phase 6: US4 - Contextual Recommendations (P2)

### Task 6.1: Update system prompt for multi-tool workflows
**Priority**: P2 | **Estimate**: S
**Prereqs**: Task 4.1, Task 5.2
**Files**:
- `backend/src/services/chatStreamService.ts`

**Requirements**: FR-022, FR-023

**Implementation**:
Extend SYSTEM_PROMPT to guide agent on:
- When to use semanticSearch (mood/theme queries)
- When to use tidalSearch (artist/album discovery)
- When to use batchMetadata (compare multiple tracks)
- How to combine results from multiple tools
- How to present mixed library/discovery results

**Acceptance**:
- [x] Agent uses appropriate tool for query type
- [x] Agent combines semantic + Tidal for comprehensive recommendations
- [x] Agent clearly distinguishes library vs. discovery tracks

---

### Task 6.2: Integration test for multi-tool playlist workflow
**Priority**: P2 | **Estimate**: M
**Prereqs**: Task 6.1
**Files**:
- `backend/tests/integration/agentTools/multiToolWorkflow.test.ts`

**Requirements**: SC-007

**Implementation**:
Test scenario:
1. User asks: "I want energetic workout music"
2. Agent calls semanticSearch for indexed tracks
3. Agent calls tidalSearch for new discoveries
4. Agent combines results
5. Verify response includes tracks from both sources

**Acceptance**:
- [x] Agent successfully combines multiple tool results
- [x] Response includes library and discovery tracks
- [x] All tool invocations traced in Langfuse
- [x] Performance within targets (< 6s total for 2 searches)

---

## Phase 7: Final

### Task 7.1: End-to-end testing and validation
**Priority**: P1 | **Estimate**: M
**Prereqs**: All previous tasks
**Files**:
- `specs/011-agent-tools/VALIDATION.md`

**Requirements**: SC-001 through SC-010

**Test Scenarios**:
1. Semantic search returns within 3s
2. Tidal search returns within 3s
3. Batch metadata for 100 ISRCs within 2s
4. Tool events stream within 500ms of lifecycle change
5. 100% of tool invocations visible in real-time
6. Historical conversations show tool invocations
7. Error handling with retry and graceful degradation
8. User interrupts chat while tool is executing (tool cancellation)
9. SSE connection lost mid-tool-invocation (graceful recovery on reconnect)

**Acceptance**:
- [x] All success criteria validated
- [x] Performance targets met
- [x] Edge cases handled (service unavailable, empty results, invalid input)
- [x] VALIDATION.md checklist completed

---

### Task 7.2: Update documentation and CLAUDE.md
**Priority**: P2 | **Estimate**: S
**Prereqs**: Task 7.1
**Files**:
- `CLAUDE.md`
- `backend/src/services/agentTools/README.md`

**Implementation**:
- Add agent tools section to CLAUDE.md
- Document tool usage patterns
- Document environment variables (none new required)
- Document testing commands

**Acceptance**:
- [x] CLAUDE.md updated with agent tools context
- [x] README documents tool implementations
- [x] Developer can understand and test tools from documentation

---

## Summary

| Phase | Tasks | Priority | Effort | Status |
|-------|-------|----------|--------|--------|
| 0: Setup | 1 | P0 | S | ✅ Complete |
| 1: Foundational | 3 | P0 | S | ✅ Complete |
| 2: US1 Semantic | 3 | P1 | M | ✅ Complete |
| 3: US2 Catalogue | 2 | P1 | M | ✅ Complete |
| 4: US5 Streaming | 5 | P1 | L | ✅ Complete |
| 5: US3 Batch | 2 | P2 | M | ✅ Complete |
| 6: US4 Contextual | 2 | P2 | M | ✅ Complete |
| 7: Final | 2 | P1/P2 | M | ✅ Complete |

**Total**: 20 tasks (20 complete)

**Critical Path**: 0.1 → 1.1/1.2/1.3 → 2.1 → 3.1 → 4.1 → 4.2 → 4.3/4.4 → 4.5 → 7.1 ✅
