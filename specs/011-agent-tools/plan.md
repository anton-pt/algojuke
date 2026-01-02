# Implementation Plan: Agent Tools for Discover Chat

**Branch**: `011-agent-tools` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-agent-tools/spec.md`

## Summary

Implement three agent tools for the Discover Chat feature: semantic library search, Tidal catalogue search, and batch track metadata retrieval. Tools integrate into the existing chat agent loop with real-time SSE streaming of tool invocations to the frontend. Tool invocations are persisted to PostgreSQL for display in historical chat sessions. Extends the existing SSE message format with `tool_call_start`, `tool_call_end`, and related events.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**:
- Backend: Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Apollo Server 4.x, TypeORM, @qdrant/js-client-rest, axios, Zod, Express
- Frontend: Apollo Client 3.x, React, react-markdown
**Storage**: PostgreSQL (via TypeORM - conversations, messages with tool content blocks), Qdrant (vector index)
**Testing**: Vitest (backend), React Testing Library (frontend)
**Target Platform**: Web application (Node.js backend, React SPA frontend)
**Project Type**: Web application with backend services
**Performance Goals**:
- Tool invocations complete within 3 seconds (semantic search, Tidal search)
- Batch metadata retrieval within 2 seconds for 100 ISRCs
- Tool events streamed within 500ms of lifecycle change
**Constraints**:
- Max 50 results for semantic search, 100 for Tidal search
- Max 100 ISRCs per batch request
- Single retry on transient failures
**Scale/Scope**: Single-user mode, conversation history up to 100 conversations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Contract tests for tool APIs, integration tests for agent loop |
| II. Code Quality Standards | ✅ PASS | Extends existing patterns, no unnecessary complexity |
| III. User Experience Consistency | ✅ PASS | Tool UI follows existing chat patterns, expandable results |
| IV. Robust Architecture | ✅ PASS | Retry logic, graceful degradation, Langfuse tracing |
| V. Security by Design | ✅ PASS | Input validation via Zod, no new auth requirements |

## Project Structure

### Documentation (this feature)

```text
specs/011-agent-tools/
├── plan.md              # This file
├── research.md          # Phase 0 output - SSE format extension, tool patterns
├── data-model.md        # Phase 1 output - ToolInvocation entity
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output - Tool schemas
│   ├── semantic-search-tool.md
│   ├── tidal-search-tool.md
│   ├── batch-metadata-tool.md
│   └── sse-tool-events.md
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── entities/
│   │   └── Message.ts              # Extend ContentBlock for tool_use/tool_result
│   ├── services/
│   │   ├── chatStreamService.ts    # Extend with tool execution loop
│   │   └── agentTools/             # NEW: Tool implementations
│   │       ├── index.ts            # Tool registry and executor
│   │       ├── semanticSearchTool.ts
│   │       ├── tidalSearchTool.ts
│   │       └── batchMetadataTool.ts
│   ├── schemas/
│   │   └── agentTools.ts           # NEW: Zod schemas for tool inputs/outputs
│   └── types/
│       └── agentTools.ts           # NEW: TypeScript types for tools
└── tests/
    ├── contract/
    │   └── agentTools/             # NEW: Tool contract tests
    └── integration/
        └── agentTools/             # NEW: Tool integration tests

frontend/
├── src/
│   ├── components/
│   │   └── chat/
│   │       ├── ChatMessage.tsx     # Extend to render tool invocations
│   │       └── ToolInvocation.tsx  # NEW: Tool invocation display component
│   ├── hooks/
│   │   └── useChatStream.ts        # Extend to handle tool events
│   └── types/
│       └── chat.ts                 # Extend with tool event types
└── tests/
    └── components/
        └── chat/
            └── ToolInvocation.test.tsx  # NEW: Component tests
```

**Structure Decision**: Extends existing web application structure. New `agentTools/` directory in backend services for clean separation. Tool implementations leverage existing clients (qdrantClient, tidalService, libraryService).

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|-------------------------------------|
| Tool invocation persistence | Historical sessions need to show tool calls | In-memory only loses data on page reload |
| SSE event extension | Real-time tool visibility per FR-027 | Polling would add latency, break UX flow |
| maxSteps: 20 limit | Allows complex multi-tool workflows without runaway loops | Higher values risk long response times, lower values limit complex recommendations |

## Key Design Decisions

### 1. Tool Definition Format (Vercel AI SDK)

Tools will be defined using Vercel AI SDK's `tool()` helper which integrates natively with `streamText()`:

```typescript
const tools = {
  semanticSearch: tool({
    description: 'Search indexed tracks by mood, theme, or description',
    parameters: z.object({
      query: z.string(),
      limit: z.number().optional().default(20)
    }),
    execute: async ({ query, limit }) => { /* implementation */ }
  }),
  // ... other tools
}
```

### 2. SSE Event Extension

Extend existing SSE format with tool-specific events:

| Event | Purpose | Payload |
|-------|---------|---------|
| `tool_call_start` | Tool execution begins | `{ type, toolCallId, toolName, input }` |
| `tool_call_end` | Tool execution completes | `{ type, toolCallId, output, durationMs }` |
| `tool_call_error` | Tool execution failed | `{ type, toolCallId, error, retryable }` |

### 3. Database Persistence

Tool invocations stored as ContentBlock entries in Message.content JSONB:
- `tool_use` block: Captures tool call with ID, name, input
- `tool_result` block: Captures result linked to tool_use_id

This matches the existing ContentBlock union type already in the codebase.

### 4. Library/Ingestion Status Flags

Each tool enriches results with:
- `inLibrary: boolean` - Check against LibraryTrack/LibraryAlbum entities
- `isIndexed: boolean` (Tidal results only) - Check Qdrant for ISRC existence

### 5. Retry Strategy

Single retry with 1-second delay for transient failures:
- Network timeouts
- Rate limit responses (429)
- Service unavailable (503)

Non-retryable: validation errors, not found, auth failures.

## Dependencies Map

```
011-agent-tools
├── 010-discover-chat (chat infrastructure, SSE streaming)
├── 009-semantic-discovery-search (hybrid search, query expansion)
├── 004-vector-search-index (Qdrant client, track schema)
├── 002-library-management (library lookup)
├── 001-tidal-search (Tidal API client)
└── 005-llm-observability (Langfuse tracing)
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tidal API rate limits during tool execution | Medium | Medium | Use existing rate limiter, single retry |
| Qdrant unavailable | Low | High | Graceful error message, suggest Tidal search |
| Large result sets slow streaming | Medium | Low | Enforce limits (50/100), pagination in future |
| Tool execution exceeds 3s target | Medium | Medium | Timeout handling, partial results |

## Phase 1 Artifacts to Generate

1. **research.md**: Vercel AI SDK tool patterns, SSE best practices
2. **data-model.md**: ToolInvocation tracking, ContentBlock extensions
3. **contracts/**: Tool input/output schemas, SSE event formats
4. **quickstart.md**: Developer setup and testing guide
