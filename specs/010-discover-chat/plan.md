# Implementation Plan: Discover Chat Agent

**Branch**: `010-discover-chat` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-discover-chat/spec.md`

## Summary

Add an AI-powered chat interface to the Discover section that enables natural language conversations about music discovery and playlist curation. The chat uses Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) for responses streamed via SSE, with conversations persisted to PostgreSQL and retrieved via GraphQL. The system prompt focuses the AI on helping users discover music matching their mood based on existing tastes and semantic search of lyric interpretations.

**Key Architectural Decisions** (from user input):
- GraphQL for conversation list and history retrieval
- REST endpoint with SSE for streaming chat responses
- Message format extensible for future tool invocations
- Langfuse tracing with session ID = conversation UUID
- Storage in existing PostgreSQL database (same as library data)

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**:
- Backend: Apollo Server 4.10.0, TypeORM 0.3.28, Express 4.x (for SSE endpoint), @ai-sdk/anthropic 1.2.12, Langfuse 3.38.6
- Frontend: Apollo Client 3.8.9, React Router DOM 7.11.0, Sonner 2.0.7
**Storage**: PostgreSQL (via TypeORM, same database as library management)
**Testing**: Vitest 1.6.1 (backend), Vitest 1.2.0 + React Testing Library 14.1.2 (frontend)
**Target Platform**: Web application (localhost development, Docker-based services)
**Project Type**: Web application (backend + frontend)
**Performance Goals**:
- First streamed token within 3 seconds (SC-001)
- Sidebar loads within 2 seconds for 100 conversations (SC-004)
- Interrupt response within 1 second (SC-003)
**Constraints**:
- Single-user model (no authentication required)
- Network connectivity required for AI responses
- Request must stay open during SSE streaming
**Scale/Scope**: Up to 100 conversations per user, unlimited messages per conversation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | PASS | Contract tests for API endpoints, integration tests for chat flow |
| II. Code Quality Standards | PASS | Following existing patterns, YAGNI applies (no tools in v1) |
| III. User Experience Consistency | PASS | Tab styling matches Library section per FR-002 |
| IV. Robust Architecture | PASS | Separation of concerns (REST for streaming, GraphQL for queries), error handling at boundaries |
| V. Security by Design | PASS | Input validation via Zod, no credentials in code, single-user model |

**All gates pass. Proceeding to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/010-discover-chat/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── chat.graphql     # GraphQL schema additions
│   └── chat-sse.md      # SSE endpoint contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── entities/
│   │   ├── Conversation.ts       # NEW: Conversation entity
│   │   └── Message.ts            # NEW: Message entity
│   ├── schema/
│   │   └── chat.graphql          # NEW: Chat GraphQL schema
│   ├── resolvers/
│   │   └── chatResolver.ts       # NEW: Chat GraphQL resolvers
│   ├── services/
│   │   └── chatService.ts        # NEW: Chat business logic
│   ├── routes/
│   │   └── chatRoutes.ts         # NEW: SSE REST endpoint
│   └── utils/
│       └── langfuse.ts           # EXTEND: Add session-based tracing
├── tests/
│   ├── contract/
│   │   └── chat.test.ts          # NEW: GraphQL contract tests
│   └── integration/
│       └── chat.test.ts          # NEW: Chat flow integration tests
└── migrations/
    └── [timestamp]-CreateChatTables.ts  # NEW: Database migration

frontend/
├── src/
│   ├── pages/
│   │   └── DiscoverPage.tsx      # MODIFY: Add Chat tab routing
│   ├── components/
│   │   └── chat/                 # NEW: Chat components directory
│   │       ├── ChatView.tsx      # NEW: Main chat interface
│   │       ├── ChatSidebar.tsx   # NEW: Conversation list sidebar
│   │       ├── ChatMessage.tsx   # NEW: Message display component
│   │       ├── ChatInput.tsx     # NEW: Message input with send/stop
│   │       └── DiscoverNav.tsx   # NEW: Search/Chat tab navigation
│   ├── hooks/
│   │   ├── useConversations.ts   # NEW: Conversation list hook
│   │   ├── useConversation.ts    # NEW: Single conversation hook
│   │   └── useChatStream.ts      # NEW: SSE streaming hook
│   └── graphql/
│       └── chat.ts               # NEW: Chat GraphQL queries/mutations
└── tests/
    └── components/
        └── chat/                 # NEW: Chat component tests
```

**Structure Decision**: Extends existing web application structure. Backend gains new entities, resolver, service, and REST route. Frontend gains new chat components following existing patterns (hooks for data, components for UI).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| REST + GraphQL hybrid | SSE streaming not well-supported by GraphQL subscriptions in current Apollo setup | Pure GraphQL would require subscriptions infrastructure not currently in place |
| Extensible message format (JSONB) | Future tool invocations need structured content blocks | Simple text field would require schema migration for tool support |

## Implementation Notes

### System Prompt Focus
The AI assistant's system prompt should focus on:
- Helping users discover music that matches their current mood
- Leveraging knowledge of their existing music tastes (from library)
- Semantic search of lyric interpretations for deeper matching
- Playlist curation recommendations based on themes and emotions

### SSE Message Format (Extensible)
```typescript
interface SSEEvent {
  type: 'message_start' | 'text_delta' | 'tool_call' | 'tool_result' | 'message_end' | 'error';
  messageId?: string;        // For message_start
  conversationId?: string;   // For message_start
  content?: string;          // For text_delta
  usage?: {                  // For message_end
    inputTokens: number;
    outputTokens: number;
  };
  toolCall?: {               // For future tool invocations
    id: string;
    name: string;
    input: unknown;
  };
  toolResult?: {             // For future tool results
    toolCallId: string;
    result: unknown;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

### Database Message Content (Extensible)
```typescript
interface MessageContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  toolUse?: { id: string; name: string; input: unknown };
  toolResult?: { toolUseId: string; content: unknown };
}
// Stored as JSONB array: content: MessageContent[]
```

### Langfuse Integration
- Session ID = Conversation UUID (enables viewing full conversation history in Langfuse)
- Each chat request creates a trace within the session
- Generation spans track token usage and latency
- Metadata includes conversation_id, message_count, model parameters
