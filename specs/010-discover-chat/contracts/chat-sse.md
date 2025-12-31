# REST API Contract: Chat Streaming (SSE)

**Feature**: 010-discover-chat
**Date**: 2025-12-31

## Overview

This document defines the REST endpoint for streaming chat responses via Server-Sent Events (SSE). This is separate from the GraphQL API because SSE streaming is better supported through REST than GraphQL subscriptions in the current stack.

---

## Endpoint

### POST `/api/chat/stream`

Stream an AI response for a chat message.

#### Request

**Headers:**
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |

**Body:**
```typescript
interface ChatStreamRequest {
  /**
   * Existing conversation ID, or omit to create a new conversation.
   */
  conversationId?: string;

  /**
   * User's message text.
   * Must be 1-10000 characters, cannot be empty or whitespace-only.
   */
  message: string;
}
```

**Validation:**
- `message` must be a non-empty string (after trimming whitespace)
- `message` maximum length: 10,000 characters
- `conversationId` (if provided) must be a valid UUID

**Example:**
```json
{
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "What are some upbeat songs about new beginnings?"
}
```

#### Response

**Headers:**
| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `text/event-stream` | SSE content type |
| `Cache-Control` | `no-cache` | Disable caching |
| `Connection` | `keep-alive` | Keep connection open |
| `X-Accel-Buffering` | `no` | Disable nginx buffering |

**Stream Format:**

Each SSE event follows the format:
```
data: <JSON payload>\n\n
```

#### Event Types

##### `message_start`

Sent at the beginning of the response. Provides message and conversation IDs.

```typescript
interface MessageStartEvent {
  type: 'message_start';
  messageId: string;        // UUID of the assistant message being created
  conversationId: string;   // UUID of the conversation (new or existing)
}
```

**Example:**
```
data: {"type":"message_start","messageId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","conversationId":"550e8400-e29b-41d4-a716-446655440000"}

```

##### `text_delta`

Sent for each chunk of generated text.

```typescript
interface TextDeltaEvent {
  type: 'text_delta';
  content: string;  // Incremental text chunk
}
```

**Example:**
```
data: {"type":"text_delta","content":"Here are some "}

data: {"type":"text_delta","content":"upbeat songs about "}

data: {"type":"text_delta","content":"new beginnings:\n\n"}

```

##### `tool_call` (Future)

Reserved for future tool integration. Sent when the AI invokes a tool.

```typescript
interface ToolCallEvent {
  type: 'tool_call';
  id: string;       // Tool call ID
  name: string;     // Tool name (e.g., 'search_library')
  input: unknown;   // Tool input parameters
}
```

##### `tool_result` (Future)

Reserved for future tool integration. Sent with tool execution results.

```typescript
interface ToolResultEvent {
  type: 'tool_result';
  toolCallId: string;   // Matching tool call ID
  result: unknown;      // Tool execution result
}
```

##### `message_end`

Sent when the response is complete. Includes token usage for observability.

```typescript
interface MessageEndEvent {
  type: 'message_end';
  usage: {
    inputTokens: number;   // Prompt tokens used
    outputTokens: number;  // Completion tokens generated
  };
}
```

**Example:**
```
data: {"type":"message_end","usage":{"inputTokens":245,"outputTokens":189}}

```

##### `error`

Sent when an error occurs during streaming.

```typescript
interface ErrorEvent {
  type: 'error';
  code: 'AI_SERVICE_UNAVAILABLE' | 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'TIMEOUT' | 'INTERNAL_ERROR';
  message: string;     // Human-readable error message
  retryable: boolean;  // Whether the request can be retried
}
```

**Example:**
```
data: {"type":"error","code":"AI_SERVICE_UNAVAILABLE","message":"The AI service is temporarily unavailable. Please try again.","retryable":true}

```

---

## Behavior

### New Conversation

When `conversationId` is omitted:
1. A new conversation is created in the database
2. The `message_start` event includes the new `conversationId`
3. The user message is saved before streaming begins
4. The assistant message is saved after streaming completes

### Existing Conversation

When `conversationId` is provided:
1. The conversation is loaded with its message history
2. Message history is included in the LLM context
3. The conversation's `updatedAt` timestamp is updated
4. Both user and assistant messages are appended

### Interruption Handling

When the client disconnects mid-stream:
1. The LLM generation is aborted (via AbortController)
2. Any partial response received is saved to the database
3. The assistant message is marked as complete (partial content preserved)
4. Resources are cleaned up

### Persistence

| Event | Database Action |
|-------|-----------------|
| Request received | Create user message, update conversation `updatedAt` |
| Stream complete | Create assistant message with full content |
| Client disconnect | Create assistant message with partial content |
| Error | No assistant message created (user can retry) |

### Langfuse Tracing

Each request creates:
1. A trace with `sessionId` = `conversationId`
2. A generation span for the LLM call with:
   - Model: `claude-sonnet-4-5-20250929`
   - Input: conversation messages
   - Output: generated response
   - Usage: token counts

---

## Error Responses

### HTTP Status Codes

| Status | Condition |
|--------|-----------|
| 200 | Stream started successfully (errors sent as SSE events) |
| 400 | Invalid request body (validation failed) |
| 404 | Conversation not found |
| 429 | Rate limited |
| 500 | Server error before stream started |

### Validation Error (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message cannot be empty",
    "details": [
      { "field": "message", "message": "Message is required" }
    ]
  }
}
```

### Not Found Error (404)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Conversation not found"
  }
}
```

---

## Client Implementation

### Fetch with ReadableStream

```typescript
async function* streamChatResponse(
  message: string,
  conversationId?: string,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ChatApiError(error);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = JSON.parse(line.slice(6)) as ChatEvent;
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### React Hook Usage

```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const abortController = useRef<AbortController>();

const sendMessage = async (text: string) => {
  abortController.current = new AbortController();
  setIsStreaming(true);

  try {
    let currentContent = '';

    for await (const event of streamChatResponse(
      text,
      conversationId,
      abortController.current.signal
    )) {
      switch (event.type) {
        case 'message_start':
          setMessages(prev => [...prev,
            { id: 'temp-user', role: 'user', content: text },
            { id: event.messageId, role: 'assistant', content: '' }
          ]);
          break;

        case 'text_delta':
          currentContent += event.content;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1].content = currentContent;
            return updated;
          });
          break;

        case 'error':
          throw new Error(event.message);
      }
    }
  } finally {
    setIsStreaming(false);
  }
};

const cancelStream = () => {
  abortController.current?.abort();
};
```

---

## Rate Limiting

| Limit | Value | Scope |
|-------|-------|-------|
| Requests per minute | 20 | Per user |
| Concurrent streams | 1 | Per user |

When rate limited, the server responds with HTTP 429 before starting the stream.

---

## Timeouts

| Timeout | Value | Description |
|---------|-------|-------------|
| First byte | 10s | Max time until first `text_delta` event |
| Total response | 120s | Max total streaming time |
| Idle | 30s | Max time between events |

Timeout errors are sent as `error` events with `code: 'TIMEOUT'`.
