# SSE Contract Extension: Tool Invocation Events

**Feature**: 011-agent-tools
**Date**: 2025-12-31
**Extends**: [010-discover-chat/contracts/chat-sse.md](../../010-discover-chat/contracts/chat-sse.md)

## Overview

This document extends the existing SSE contract with three new event types for streaming tool invocations to the frontend. These events enable real-time visibility into the agent's work as it searches for music.

---

## New Event Types

### `tool_call_start`

Sent when the agent begins executing a tool. The frontend should display a "searching..." indicator.

```typescript
interface ToolCallStartEvent {
  type: 'tool_call_start';

  /**
   * Unique identifier for this tool invocation.
   * Used to match with corresponding end/error event.
   */
  toolCallId: string;

  /**
   * Name of the tool being invoked.
   */
  toolName: 'semanticSearch' | 'tidalSearch' | 'batchMetadata' | 'albumTracks';

  /**
   * Input parameters for the tool.
   * Structure varies by tool type.
   */
  input: SemanticSearchInput | TidalSearchInput | BatchMetadataInput | AlbumTracksInput;
}
```

**Example**:
```
data: {"type":"tool_call_start","toolCallId":"tc_abc123","toolName":"semanticSearch","input":{"query":"melancholic love songs","limit":10}}

```

---

### `tool_call_end`

Sent when a tool completes successfully. Includes a summary for display and the full result for expansion.

```typescript
interface ToolCallEndEvent {
  type: 'tool_call_end';

  /**
   * Matches the toolCallId from the corresponding start event.
   */
  toolCallId: string;

  /**
   * Human-readable summary for display.
   * Examples:
   * - "Found 12 tracks matching 'melancholic love songs'"
   * - "Found 5 albums and 20 tracks for 'Radiohead'"
   * - "Retrieved metadata for 8 of 10 requested tracks"
   */
  summary: string;

  /**
   * Number of results returned (for display badge).
   */
  resultCount: number;

  /**
   * Execution time in milliseconds (for observability).
   */
  durationMs: number;

  /**
   * Full tool output for expansion/inspection.
   * Only sent if results exist; omitted for empty results.
   */
  output?: SemanticSearchOutput | TidalSearchOutput | BatchMetadataOutput | AlbumTracksOutput;
}
```

**Example (with results)**:
```
data: {"type":"tool_call_end","toolCallId":"tc_abc123","summary":"Found 8 tracks matching 'melancholic love songs'","resultCount":8,"durationMs":1234,"output":{"tracks":[...],"query":"melancholic love songs","totalFound":8}}

```

**Example (no results)**:
```
data: {"type":"tool_call_end","toolCallId":"tc_abc123","summary":"No tracks found matching 'obscure query'","resultCount":0,"durationMs":876}

```

---

### `tool_call_error`

Sent when a tool invocation fails. Indicates whether retry was attempted.

```typescript
interface ToolCallErrorEvent {
  type: 'tool_call_error';

  /**
   * Matches the toolCallId from the corresponding start event.
   */
  toolCallId: string;

  /**
   * Human-readable error message.
   * Examples:
   * - "Vector search service is temporarily unavailable"
   * - "Tidal search timed out. Try again or search your indexed collection."
   * - "Invalid ISRC format in request"
   */
  error: string;

  /**
   * Whether the operation can be retried by the user.
   */
  retryable: boolean;

  /**
   * Whether an automatic retry was already attempted.
   * true = this is the error after retry failed
   * false = immediate failure, no retry attempted (e.g., validation error)
   */
  wasRetried: boolean;
}
```

**Example (after retry)**:
```
data: {"type":"tool_call_error","toolCallId":"tc_abc123","error":"Vector search service is temporarily unavailable","retryable":false,"wasRetried":true}

```

**Example (validation error, no retry)**:
```
data: {"type":"tool_call_error","toolCallId":"tc_def456","error":"Query cannot be empty","retryable":false,"wasRetried":false}

```

---

## Updated Event Union

```typescript
type SSEEvent =
  // Existing events
  | MessageStartEvent
  | TextDeltaEvent
  | MessageEndEvent
  | ErrorEvent
  // New tool events
  | ToolCallStartEvent
  | ToolCallEndEvent
  | ToolCallErrorEvent;
```

---

## Event Sequence

### Successful Tool Call

```
1. data: {"type":"message_start",...}
2. data: {"type":"text_delta","content":"Let me search for some melancholic songs..."}
3. data: {"type":"tool_call_start","toolCallId":"tc_1","toolName":"semanticSearch",...}
4. data: {"type":"tool_call_end","toolCallId":"tc_1","summary":"Found 8 tracks...",...}
5. data: {"type":"text_delta","content":"I found 8 tracks that match..."}
6. data: {"type":"text_delta","content":"Here are the top results:\n\n1. **Someone Like You**..."}
7. data: {"type":"message_end","usage":{...}}
```

### Failed Tool Call (with retry)

```
1. data: {"type":"message_start",...}
2. data: {"type":"text_delta","content":"Let me search the Tidal catalogue..."}
3. data: {"type":"tool_call_start","toolCallId":"tc_1","toolName":"tidalSearch",...}
   [Backend: first attempt fails with 503]
   [Backend: waits 1 second]
   [Backend: retry attempt also fails]
4. data: {"type":"tool_call_error","toolCallId":"tc_1","error":"Tidal service is unavailable...","wasRetried":true}
5. data: {"type":"text_delta","content":"I couldn't reach Tidal right now. Let me search your indexed collection instead..."}
6. data: {"type":"tool_call_start","toolCallId":"tc_2","toolName":"semanticSearch",...}
7. data: {"type":"tool_call_end","toolCallId":"tc_2","summary":"Found 5 tracks...",...}
8. data: {"type":"text_delta","content":"I found 5 similar tracks in your collection..."}
9. data: {"type":"message_end","usage":{...}}
```

### Multiple Tool Calls

```
1. data: {"type":"message_start",...}
2. data: {"type":"text_delta","content":"I'll search your indexed collection and Tidal..."}
3. data: {"type":"tool_call_start","toolCallId":"tc_1","toolName":"semanticSearch",...}
4. data: {"type":"tool_call_end","toolCallId":"tc_1","summary":"Found 5 tracks...",...}
5. data: {"type":"tool_call_start","toolCallId":"tc_2","toolName":"tidalSearch",...}
6. data: {"type":"tool_call_end","toolCallId":"tc_2","summary":"Found 10 tracks...",...}
7. data: {"type":"text_delta","content":"I found 5 tracks in your collection and 10 new discoveries..."}
8. data: {"type":"message_end","usage":{...}}
```

---

## Frontend Handling

### State Management

```typescript
interface ToolInvocationState {
  toolCallId: string;
  toolName: string;
  input: unknown;
  status: 'executing' | 'completed' | 'failed';
  summary?: string;
  resultCount?: number;
  output?: unknown;
  error?: string;
  durationMs?: number;
  expanded: boolean;  // UI state for accordion
}

// In useChatStream hook
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
  setToolInvocations(prev => {
    const updated = new Map(prev);
    const existing = updated.get(event.toolCallId);
    if (existing) {
      updated.set(event.toolCallId, {
        ...existing,
        status: 'completed',
        summary: event.summary,
        resultCount: event.resultCount,
        output: event.output,
        durationMs: event.durationMs,
      });
    }
    return updated;
  });
  break;

case 'tool_call_error':
  setToolInvocations(prev => {
    const updated = new Map(prev);
    const existing = updated.get(event.toolCallId);
    if (existing) {
      updated.set(event.toolCallId, {
        ...existing,
        status: 'failed',
        error: event.error,
      });
    }
    return updated;
  });
  break;
```

### Rendering in Chat Message

Tool invocations appear inline in the assistant's message at the point where they were called:

```tsx
const ChatMessage = ({ content, toolInvocations }) => {
  // Interleave text and tool invocations based on order
  return (
    <div className="message">
      {content.map((block, i) => {
        if (block.type === 'text') {
          return <Markdown key={i}>{block.text}</Markdown>;
        }
        if (block.type === 'tool_use') {
          const invocation = toolInvocations.get(block.id);
          return <ToolInvocation key={i} {...invocation} />;
        }
        // tool_result blocks are rendered within ToolInvocation
        return null;
      })}
    </div>
  );
};
```

---

## Persistence

Tool events are NOT directly persisted - they are transient streaming events. The persisted form is the ContentBlock array in the Message entity:

| SSE Event | Persisted As |
|-----------|--------------|
| `tool_call_start` | Part of context for `tool_use` block |
| `tool_call_end` | `tool_result` block with output |
| `tool_call_error` | `tool_result` block with error |

When loading historical conversations, the frontend reconstructs tool invocation display from `tool_use` and `tool_result` content blocks.

---

## Performance Requirements

- **SC-009**: Tool events streamed within 500ms of lifecycle change
- **SC-010**: 100% of tool invocations visible in real-time

The backend MUST emit events immediately when:
1. Tool execution begins → `tool_call_start`
2. Tool execution completes → `tool_call_end` or `tool_call_error`

Events should not be batched or delayed.
