# Quickstart: Discover Chat Agent

**Feature**: 010-discover-chat
**Date**: 2025-12-31

## Prerequisites

Before starting development on this feature, ensure:

1. **Docker services running**:
   ```bash
   docker compose up -d
   ```
   This starts PostgreSQL, Qdrant, Inngest, and Langfuse.

2. **Backend and frontend dependencies installed**:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Environment variables configured**:
   ```bash
   # Backend .env
   ANTHROPIC_API_KEY=sk-ant-...  # Required for Claude API
   LANGFUSE_PUBLIC_KEY=pk-...    # From Langfuse dashboard
   LANGFUSE_SECRET_KEY=sk-...    # From Langfuse dashboard
   LANGFUSE_BASE_URL=http://localhost:3000
   ```

4. **Database migrations applied** (after creating new entities):
   ```bash
   cd backend
   npm run migration:generate -- -n CreateChatTables
   npm run migration:run
   ```

---

## Development Workflow

### 1. Start Services

```bash
# Terminal 1: Docker services
docker compose up -d

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 2. Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | - |
| GraphQL Playground | http://localhost:4000/graphql | - |
| Langfuse Dashboard | http://localhost:3000 | admin@localhost.dev / adminadmin |
| Qdrant Dashboard | http://localhost:6333/dashboard | - |

### 3. Testing the Feature

#### GraphQL Queries (Playground)

```graphql
# List conversations
query {
  conversations {
    ... on ConversationsList {
      conversations {
        id
        preview
        updatedAt
        messageCount
      }
      totalCount
    }
    ... on ChatError {
      message
      code
    }
  }
}

# Get conversation with messages
query {
  conversation(id: "550e8400-e29b-41d4-a716-446655440000") {
    ... on ConversationWithMessages {
      conversation {
        id
        preview
        updatedAt
      }
      messages {
        id
        role
        content {
          type
          text
        }
        createdAt
      }
    }
    ... on ChatError {
      message
      code
    }
  }
}

# Delete conversation
mutation {
  deleteConversation(id: "550e8400-e29b-41d4-a716-446655440000") {
    ... on DeleteSuccess {
      deletedId
      message
    }
    ... on ChatError {
      message
      code
    }
  }
}
```

#### SSE Endpoint (curl)

```bash
# Start a new conversation
curl -N -X POST http://localhost:4000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What are some good songs for a road trip?"}'

# Continue existing conversation
curl -N -X POST http://localhost:4000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Something more upbeat please"
  }'
```

---

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `src/entities/Conversation.ts` | Conversation TypeORM entity |
| `src/entities/Message.ts` | Message TypeORM entity |
| `src/schema/chat.graphql` | GraphQL schema |
| `src/resolvers/chatResolver.ts` | GraphQL resolvers |
| `src/services/chatService.ts` | Business logic |
| `src/routes/chatRoutes.ts` | SSE endpoint |
| `src/utils/langfuse.ts` | Langfuse integration |

### Frontend

| File | Purpose |
|------|---------|
| `src/pages/DiscoverPage.tsx` | Discover page with tabs |
| `src/components/chat/ChatView.tsx` | Main chat interface |
| `src/components/chat/ChatSidebar.tsx` | Conversation list |
| `src/components/chat/ChatMessage.tsx` | Message display |
| `src/components/chat/ChatInput.tsx` | Message input |
| `src/components/chat/DiscoverNav.tsx` | Search/Chat tabs |
| `src/hooks/useConversations.ts` | Conversation list hook |
| `src/hooks/useConversation.ts` | Single conversation hook |
| `src/hooks/useChatStream.ts` | SSE streaming hook |
| `src/graphql/chat.ts` | GraphQL queries |

---

## Testing

### Run Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Specific test file
npm test -- src/services/chatService.test.ts
```

### Test Categories

| Category | Location | What it tests |
|----------|----------|---------------|
| Contract | `backend/tests/contract/chat.test.ts` | GraphQL schema, SSE format |
| Integration | `backend/tests/integration/chat.test.ts` | End-to-end chat flow |
| Component | `frontend/tests/components/chat/` | React components |
| Hook | `frontend/tests/hooks/` | React hooks |

---

## Debugging

### Langfuse Traces

1. Open http://localhost:3000
2. Navigate to **Traces**
3. Filter by:
   - Session ID: `<conversation-uuid>` to see all messages in a conversation
   - Name: `chat-message` for individual requests
4. Click a trace to see:
   - Input messages (conversation history)
   - Output (generated response)
   - Token usage and latency

### SSE Debugging

```bash
# Watch SSE events in terminal
curl -N -X POST http://localhost:4000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}' 2>&1 | tee /dev/tty
```

### Database Inspection

```bash
# Connect to PostgreSQL
docker exec -it algojuke-db psql -U algojuke -d algojuke

# View conversations
SELECT id, user_id, created_at, updated_at FROM conversations ORDER BY updated_at DESC;

# View messages for a conversation
SELECT id, role, content, created_at
FROM messages
WHERE conversation_id = '550e8400-...'
ORDER BY created_at;
```

---

## Common Issues

### "AI service unavailable" error

**Cause**: Missing or invalid `ANTHROPIC_API_KEY`

**Fix**: Add valid API key to `backend/.env`

### Langfuse traces not appearing

**Cause**: Langfuse client not flushing

**Fix**: Ensure `flushLangfuse()` is called after operations

### SSE connection dropping

**Cause**: Proxy buffering (nginx, cloudflare)

**Fix**: Headers `X-Accel-Buffering: no` and `Cache-Control: no-cache` are set

### Messages not persisting

**Cause**: Database connection or transaction error

**Fix**: Check PostgreSQL logs, verify migration ran

---

## Implementation Checklist

- [ ] Create TypeORM entities (Conversation, Message)
- [ ] Run database migration
- [ ] Add GraphQL schema to `src/schema/chat.graphql`
- [ ] Implement chat resolvers
- [ ] Implement chat service
- [ ] Add SSE endpoint to Express
- [ ] Integrate Langfuse tracing with session ID
- [ ] Create frontend hooks (useConversations, useConversation, useChatStream)
- [ ] Create chat components (ChatView, ChatSidebar, ChatMessage, ChatInput)
- [ ] Add DiscoverNav tabs (Search/Chat)
- [ ] Update DiscoverPage routing
- [ ] Write contract tests
- [ ] Write integration tests
- [ ] Write component tests
