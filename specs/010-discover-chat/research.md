# Research: Discover Chat Agent

**Feature**: 010-discover-chat
**Date**: 2025-12-31

## Research Summary

This document captures technical decisions and patterns for implementing the Discover Chat feature based on codebase exploration and user requirements.

---

## 1. Streaming Architecture

### Decision: REST endpoint with SSE for chat streaming

**Rationale**: The existing Apollo Server setup doesn't include GraphQL Subscriptions infrastructure. SSE provides a simpler, well-supported alternative for server-to-client streaming that works with the existing Express-compatible stack.

**Alternatives Considered**:
- **WebSockets**: More complex, requires additional infrastructure, overkill for unidirectional streaming
- **GraphQL Subscriptions**: Would require adding subscription support to Apollo Server and client
- **Long polling**: Less efficient, higher latency

**Pattern from Codebase**:
The worker service (`/services/worker/src/server.ts`) demonstrates Express route setup that can be extended for SSE:

```typescript
import express from "express";
const app = express();
app.use(express.json());

// SSE endpoint pattern
app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // ... stream handling
});
```

---

## 2. Vercel AI SDK Streaming

### Decision: Use `streamText` from `ai` package with `@ai-sdk/anthropic`

**Rationale**: The codebase already uses these packages for LLM interactions. The `streamText` function provides built-in streaming support with the same model initialization pattern.

**Alternatives Considered**:
- **Direct Anthropic SDK**: Would require custom stream handling
- **Fetch with manual parsing**: More error-prone, less features

**Pattern from Codebase** (`/backend/src/clients/anthropicClient.ts`):

```typescript
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// Current non-streaming pattern
const result = await generateText({
  model: anthropic(QUERY_EXPANSION_MODEL),
  prompt: buildQueryExpansionPrompt(userQuery),
  maxTokens: 200,
});

// Streaming adaptation
import { streamText } from "ai";

const stream = await streamText({
  model: anthropic("claude-sonnet-4-5-20250929"),
  messages: conversationMessages,
  maxTokens: 4096,
  abortSignal: controller.signal,  // For interruption
});

for await (const chunk of stream.textStream) {
  res.write(`data: ${JSON.stringify({ type: 'text_delta', content: chunk })}\n\n`);
}
```

---

## 3. Langfuse Session-Based Tracing

### Decision: Use conversation UUID as Langfuse session ID

**Rationale**: This groups all traces for a conversation in Langfuse's session view, making it easy to review the full conversation history with token usage and latency metrics.

**Pattern from Codebase** (`/backend/src/utils/langfuse.ts`):

```typescript
export function createDiscoveryTrace(
  query: string,
  sessionId?: string
): DiscoveryTrace | null {
  const client = getLangfuseClient();
  return client.trace({
    name: "discovery-search",
    metadata: { query },
    sessionId,  // Already supported!
    tags: ["discovery", "search"],
  });
}
```

**Chat Implementation**:

```typescript
export function createChatTrace(
  conversationId: string,
  messageContent: string
): ChatTrace | null {
  const client = getLangfuseClient();
  return client.trace({
    name: "chat-message",
    sessionId: conversationId,  // Conversation UUID groups all messages
    metadata: {
      messageContent,
      timestamp: new Date().toISOString(),
    },
    tags: ["chat", "discover"],
  });
}
```

---

## 4. Message Format Extensibility

### Decision: JSONB array of content blocks for message storage

**Rationale**: Following Claude's message format allows storing text, tool_use, and tool_result blocks in a unified structure. This enables future tool integration without schema changes.

**Alternatives Considered**:
- **Simple text column**: Would require migration for tool support
- **Separate tool tables**: More complex queries, harder to maintain order

**Message Content Schema**:

```typescript
// Matches Claude API message structure
interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;           // For tool_use
  name?: string;         // For tool_use
  input?: unknown;       // For tool_use
  tool_use_id?: string;  // For tool_result
  content?: unknown;     // For tool_result
}

// Database column: content JSONB NOT NULL DEFAULT '[]'
```

---

## 5. SSE Event Format

### Decision: Typed SSE events with future tool support

**Rationale**: A typed event format allows the frontend to handle different event types appropriately and can be extended for tool invocations.

```typescript
// SSE Event Types
type SSEEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'message_start'; messageId: string }
  | { type: 'message_end'; usage: { input: number; output: number } }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolCallId: string; result: unknown }
  | { type: 'error'; code: string; message: string; retryable: boolean };

// Wire format: data: {"type":"text_delta","content":"Hello"}\n\n
```

---

## 6. Frontend SSE Consumption

### Decision: Fetch with ReadableStream (not EventSource)

**Rationale**: Fetch with ReadableStream provides better control over request lifecycle (POST with body, custom headers) and abort handling compared to EventSource (GET only).

**Pattern**:

```typescript
async function* consumeSSEStream(
  url: string,
  body: object,
  signal: AbortSignal
): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6));
      }
    }
  }
}
```

---

## 7. Response Interruption

### Decision: AbortController with partial message preservation

**Rationale**: Users should be able to stop generation while keeping what was already received. The spec requires interrupt response within 1 second (SC-003).

**Pattern from Codebase** (`/services/observability/src/client.ts`):

```typescript
const response = await fetch(url, {
  signal: AbortSignal.timeout(5000),
});
```

**Chat Implementation**:

```typescript
// Frontend hook
const abortControllerRef = useRef<AbortController>(new AbortController());

const cancel = useCallback(() => {
  abortControllerRef.current.abort();
  // Partial message is already in state from streaming updates
  setIsGenerating(false);
}, []);

// Backend handler
app.post('/api/chat/stream', async (req, res) => {
  req.on('close', () => {
    // Client disconnected, abort LLM stream
    llmAbortController.abort();
    // Save partial message if any content was generated
  });
});
```

---

## 8. Tab Navigation Pattern

### Decision: Follow LibraryNav component pattern with React Router NavLink

**Pattern from Codebase** (`/frontend/src/components/library/LibraryNav.tsx`):

```typescript
export function LibraryNav() {
  return (
    <nav className="library-nav">
      <NavLink to="/library/albums" className={({ isActive }) =>
        isActive ? 'nav-link active' : 'nav-link'
      }>
        Albums
      </NavLink>
      <NavLink to="/library/tracks" className={({ isActive }) =>
        isActive ? 'nav-link active' : 'nav-link'
      }>
        Tracks
      </NavLink>
    </nav>
  );
}
```

**Discover Navigation**:

```typescript
export function DiscoverNav() {
  return (
    <nav className="discover-nav">  {/* Same styling as library-nav */}
      <NavLink to="/discover/search" className={({ isActive }) =>
        isActive ? 'nav-link active' : 'nav-link'
      }>
        Search
      </NavLink>
      <NavLink to="/discover/chat" className={({ isActive }) =>
        isActive ? 'nav-link active' : 'nav-link'
      }>
        Chat
      </NavLink>
    </nav>
  );
}
```

---

## 9. System Prompt Design

### Decision: Focus on music discovery and mood-based recommendations

**System Prompt Focus Areas**:
1. Music discovery that matches user's current mood
2. Leveraging knowledge of existing music tastes (from library)
3. Semantic search of lyric interpretations
4. Playlist curation based on themes and emotions

**Draft System Prompt**:

```text
You are a music discovery assistant for AlgoJuke. Your role is to help users discover music that matches their mood and preferences.

Key capabilities:
- Recommend music based on mood, theme, or emotional context
- Discuss songs, artists, albums, and musical styles
- Help users explore their existing music library in new ways
- Suggest tracks based on lyric themes and interpretations

Personality:
- Knowledgeable and passionate about music
- Conversational but focused on music discovery
- Ask clarifying questions to understand what the user is looking for

Note: In this version, you don't have access to search tools. Engage in conversation about music and provide general recommendations. Future updates will add the ability to search the user's library and Tidal.
```

---

## 10. Database Considerations

### Decision: Use existing PostgreSQL with TypeORM entities

**Pattern from Codebase** (`/backend/src/entities/LibraryTrack.ts`):

```typescript
@Entity('library_tracks')
@Index(['tidalTrackId'], { unique: true })
@Index(['userId'])
export class LibraryTrack {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  // ...
}
```

**Chat Entity Pattern**:

```typescript
@Entity('conversations')
@Index(['userId'])
@Index(['updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
  @OneToMany(() => Message, message => message.conversation)
  messages!: Message[];
}

@Entity('messages')
@Index(['conversationId'])
@Index(['createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'conversation_id', type: 'uuid' }) conversationId!: string;
  @Column({ type: 'varchar', length: 20 }) role!: 'user' | 'assistant';
  @Column({ type: 'jsonb', default: '[]' }) content!: ContentBlock[];
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @ManyToOne(() => Conversation, conversation => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;
}
```

---

## Dependencies Summary

| Dependency | Version | Purpose |
|------------|---------|---------|
| ai | ^4.3.19 | Vercel AI SDK (streamText) |
| @ai-sdk/anthropic | ^1.2.12 | Claude provider |
| langfuse | ^3.38.6 | Observability |
| express | ^4.x | SSE endpoint |
| typeorm | ^0.3.28 | Database ORM |

All dependencies are already available in the project.

---

## Open Questions Resolved

| Question | Resolution |
|----------|------------|
| How to handle GraphQL + streaming? | Hybrid: GraphQL for queries, REST+SSE for streaming |
| Session tracking in Langfuse? | sessionId parameter = conversation UUID |
| Message format for tools? | JSONB array of content blocks matching Claude API |
| Tab styling consistency? | Follow LibraryNav pattern with NavLink |
| Interruption handling? | AbortController with partial message preservation |
