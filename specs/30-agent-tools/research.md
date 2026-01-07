# Research: Agent Tools for Discover Chat

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Research Tasks

### 1. Vercel AI SDK Tool Integration

**Decision**: Use Vercel AI SDK's native tool support with `streamText()` and `maxSteps` for agentic loops.

**Rationale**:
- Already using `streamText()` from `ai` package in chatStreamService.ts
- SDK provides native `tool()` helper for type-safe tool definitions
- `maxSteps` parameter enables automatic tool calling loops
- Built-in streaming of tool calls via `toolCallStream` and `toolResultStream`

**Alternatives Considered**:
- Manual tool execution outside SDK: Rejected - would require reimplementing streaming logic
- LangChain tools: Rejected - additional dependency, different patterns than existing code

**Key Implementation Details**:

```typescript
import { streamText, tool } from 'ai';
import { z } from 'zod';

const tools = {
  semanticSearch: tool({
    description: 'Search indexed tracks by mood, theme, or lyrics description',
    parameters: z.object({
      query: z.string().describe('Natural language search query'),
      limit: z.number().min(1).max(50).default(20).optional(),
    }),
    execute: async ({ query, limit }) => {
      // Execute search and return results
      return { tracks: [...], query, totalFound: n };
    },
  }),
};

const result = streamText({
  model: anthropic(CHAT_MODEL),
  system: SYSTEM_PROMPT,
  messages,
  tools,
  maxSteps: 5, // Allow up to 5 tool-calling rounds
  onStepFinish: ({ stepType, toolCalls, toolResults }) => {
    // Stream tool events to client
  },
});
```

**Sources**: [AI SDK Tools Documentation](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling), [AI SDK 6 Announcement](https://vercel.com/blog/ai-sdk-6)

---

### 2. SSE Event Extension for Tool Invocations

**Decision**: Extend existing SSE format with 3 new event types: `tool_call_start`, `tool_call_end`, `tool_call_error`.

**Rationale**:
- Existing contract already has placeholder for `tool_call` and `tool_result` events
- Need distinct start/end events to show progress (FR-028, FR-029)
- Error event needed for graceful failure handling (FR-025)
- Must include timing for observability (SC-009)

**Alternatives Considered**:
- Single `tool_call` event with status field: Rejected - harder to parse incrementally
- WebSocket for bi-directional: Rejected - overkill for unidirectional streaming

**Extended Event Types**:

```typescript
// NEW: Tool execution begins
interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolCallId: string;      // Unique ID for this invocation
  toolName: string;        // 'semanticSearch' | 'tidalSearch' | 'batchMetadata'
  input: {                 // Tool-specific input
    query?: string;
    limit?: number;
    searchType?: 'tracks' | 'albums' | 'both';
    isrcs?: string[];
  };
}

// NEW: Tool execution completes successfully
interface ToolCallEndEvent {
  type: 'tool_call_end';
  toolCallId: string;      // Matches start event
  summary: string;         // "Found 12 tracks matching 'melancholic love songs'"
  resultCount: number;     // Number of results
  durationMs: number;      // Execution time for observability
}

// NEW: Tool execution failed
interface ToolCallErrorEvent {
  type: 'tool_call_error';
  toolCallId: string;
  error: string;           // Human-readable error message
  retryable: boolean;      // Whether retry was attempted
  wasRetried: boolean;     // Whether this is after a retry
}
```

**Event Sequence Example**:
```
data: {"type":"message_start","messageId":"...","conversationId":"..."}
data: {"type":"text_delta","content":"Let me search for some melancholic songs..."}
data: {"type":"tool_call_start","toolCallId":"tc_1","toolName":"semanticSearch","input":{"query":"melancholic love songs","limit":10}}
data: {"type":"tool_call_end","toolCallId":"tc_1","summary":"Found 8 tracks matching 'melancholic love songs'","resultCount":8,"durationMs":1234}
data: {"type":"text_delta","content":"I found 8 tracks that match your mood..."}
data: {"type":"message_end","usage":{"inputTokens":500,"outputTokens":300}}
```

---

### 3. Database Persistence Strategy

**Decision**: Persist tool invocations as ContentBlock entries in the existing Message.content JSONB column.

**Rationale**:
- `ContentBlock` type already includes `tool_use` and `tool_result` variants
- No schema migration required - JSONB is flexible
- Matches Claude API message structure for conversation reconstruction
- Historical sessions automatically include tool calls when loaded

**Alternatives Considered**:
- Separate ToolInvocation table: Rejected - adds complexity, requires joins
- Store only text summaries: Rejected - loses structured data for display

**Storage Format**:

```typescript
// Assistant message with tool call
{
  id: "msg_123",
  role: "assistant",
  content: [
    { type: "text", text: "Let me search for some melancholic songs..." },
    {
      type: "tool_use",
      id: "tc_1",
      name: "semanticSearch",
      input: { query: "melancholic love songs", limit: 10 }
    },
    {
      type: "tool_result",
      tool_use_id: "tc_1",
      content: {
        tracks: [...],
        summary: "Found 8 tracks",
        durationMs: 1234
      }
    },
    { type: "text", text: "I found 8 tracks that match your mood..." }
  ]
}
```

**Reconstruction for LLM Context**:

When loading conversation history, content blocks are passed to Claude in native format. The AI SDK handles the `tool_use`/`tool_result` structure automatically.

---

### 4. Library and Ingestion Status Enrichment

**Decision**: Each tool result includes `inLibrary` and `isIndexed` flags for every track/album.

**Rationale**:
- FR-004, FR-009, FR-010, FR-011 require these flags
- Single-user mode means simple lookups against LibraryTrack/LibraryAlbum entities
- ISRC is the join key between Tidal results and Qdrant index

**Implementation Approach**:

```typescript
// For semantic search results (already indexed)
const enrichWithLibraryStatus = async (tracks: QdrantTrack[]) => {
  const isrcs = tracks.map(t => t.isrc);
  const libraryTracks = await libraryService.getTracksByIsrcs(isrcs);
  const librarySet = new Set(libraryTracks.map(t => t.metadata?.isrc));

  return tracks.map(t => ({
    ...t,
    inLibrary: librarySet.has(t.isrc),
    isIndexed: true, // Always true for semantic search results
  }));
};

// For Tidal search results (may or may not be indexed)
const enrichTidalResults = async (tracks: TidalTrack[]) => {
  const isrcs = tracks.map(t => t.isrc).filter(Boolean);

  // Check library membership
  const libraryTracks = await libraryService.getTracksByIsrcs(isrcs);
  const librarySet = new Set(libraryTracks.map(t => t.metadata?.isrc));

  // Check index status
  const indexedStatuses = await Promise.all(
    isrcs.map(isrc => qdrantClient.checkTrackExists(isrc))
  );
  const indexedSet = new Set(isrcs.filter((_, i) => indexedStatuses[i]));

  return tracks.map(t => ({
    ...t,
    inLibrary: t.isrc ? librarySet.has(t.isrc) : false,
    isIndexed: t.isrc ? indexedSet.has(t.isrc) : false,
  }));
};
```

---

### 5. Retry Strategy for Transient Failures

**Decision**: Single automatic retry with 1-second delay for transient failures only (FR-033).

**Rationale**:
- User clarification specified "retry once automatically with brief delay"
- Keeps tool execution within 3-second target (SC-001, SC-002)
- Distinguishes transient (network, rate limit) from permanent (validation) errors

**Alternatives Considered**:
- No retry: Rejected - poor UX for transient failures
- Multiple retries with backoff: Rejected - would exceed performance targets

**Retryable Conditions**:
- Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- HTTP 429 (Rate Limited)
- HTTP 503 (Service Unavailable)
- HTTP 504 (Gateway Timeout)

**Non-Retryable Conditions**:
- Validation errors (invalid ISRC format)
- HTTP 400 (Bad Request)
- HTTP 401/403 (Auth failures)
- HTTP 404 (Not Found)

**Implementation**:

```typescript
const executeWithRetry = async <T>(
  fn: () => Promise<T>,
  toolName: string
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (isRetryableError(error)) {
      logger.warn(`${toolName}_retry_attempt`, { error: error.message });
      await delay(1000);
      return fn(); // Single retry, no catch - let it throw if fails again
    }
    throw error;
  }
};
```

---

### 6. Frontend Tool Invocation Display

**Decision**: Tool invocations displayed as expandable cards within the chat message.

**Rationale**:
- FR-034 requires expandable results
- Concise summary visible by default (FR-030)
- Full results available on click
- Matches existing accordion pattern from track metadata display

**Component Structure**:

```typescript
// ToolInvocation.tsx
interface ToolInvocationProps {
  toolName: string;
  input: unknown;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  summary?: string;
  resultCount?: number;
  results?: unknown;
  error?: string;
  durationMs?: number;
}

const ToolInvocation: React.FC<ToolInvocationProps> = (props) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-invocation">
      <div className="tool-header" onClick={() => setExpanded(!expanded)}>
        <ToolIcon name={props.toolName} />
        <span className="tool-name">{formatToolName(props.toolName)}</span>
        <StatusBadge status={props.status} />
        {props.summary && <span className="summary">{props.summary}</span>}
        <ChevronIcon expanded={expanded} />
      </div>
      {expanded && props.results && (
        <div className="tool-results">
          <ToolResultsRenderer
            toolName={props.toolName}
            results={props.results}
          />
        </div>
      )}
    </div>
  );
};
```

---

### 7. Langfuse Tracing for Tool Invocations

**Decision**: Each tool invocation creates a span nested under the chat generation trace.

**Rationale**:
- FR-024 requires tracing to Langfuse
- SC-006 requires complete input/output data
- Existing chat service already creates traces with conversation as sessionId

**Tracing Structure**:

```
Trace: chat-message (sessionId: conversationId)
├── Generation: claude-response
│   ├── Span: tool-call (semanticSearch)
│   │   ├── input: { query, limit }
│   │   ├── output: { tracks: [...], count }
│   │   └── duration: 1234ms
│   ├── Span: tool-call (tidalSearch)
│   │   └── ...
│   └── text output
└── Usage: { inputTokens, outputTokens }
```

**Implementation**:

```typescript
const executeToolWithTracing = async (
  trace: LangfuseTrace,
  toolName: string,
  input: unknown,
  fn: () => Promise<unknown>
) => {
  const span = trace.span({
    name: `tool-${toolName}`,
    input,
  });

  const startTime = Date.now();
  try {
    const result = await fn();
    span.end({
      output: result,
      metadata: { durationMs: Date.now() - startTime },
    });
    return result;
  } catch (error) {
    span.end({
      level: 'ERROR',
      statusMessage: error.message,
      metadata: { durationMs: Date.now() - startTime },
    });
    throw error;
  }
};
```

---

## Summary of Decisions

| Topic | Decision | Key Benefit |
|-------|----------|-------------|
| SDK Integration | Vercel AI SDK native tools | Zero-config streaming, type safety |
| SSE Events | 3 new event types (start/end/error) | Real-time progress visibility |
| Persistence | ContentBlock in JSONB | No migration, flexible structure |
| Status Flags | Inline enrichment per result | Minimal extra queries |
| Retry Strategy | Single retry, 1s delay | Resilience within latency targets |
| Frontend Display | Expandable cards | Concise default, detail on demand |
| Observability | Nested Langfuse spans | Drill-down debugging |
