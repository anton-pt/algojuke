# Quickstart: Agent Tools for Discover Chat

**Feature**: 011-agent-tools
**Date**: 2025-12-31

## Prerequisites

Ensure the following services are running:

```bash
# Start all infrastructure
docker compose up -d

# Verify services
docker compose ps
```

Required services:
- PostgreSQL (port 5432) - Conversation/message storage
- Qdrant (port 6333) - Vector index
- Inngest Dev Server (port 8288) - Background tasks
- Langfuse (port 3000) - Observability

## Development Setup

### Backend

```bash
cd backend

# Install dependencies
npm install

# Run migrations (if new entities added)
npm run migration:run

# Start development server
npm run dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Worker (for ingestion)

```bash
cd services/worker

# Install dependencies
npm install

# Start worker
npm run dev
```

## Environment Variables

Add to `backend/.env`:

```bash
# Existing vars should already be configured
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
TIDAL_CLIENT_ID=...
TIDAL_CLIENT_SECRET=...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...

# No new vars required for agent tools
```

## Testing the Feature

### 1. Verify Prerequisites

Ensure you have indexed tracks in Qdrant:

```bash
# Check Qdrant collection count
curl http://localhost:6333/collections/tracks | jq '.result.points_count'
```

If count is 0, add tracks to your library and wait for ingestion to complete.

### 2. Test Semantic Search Tool

In the chat interface, try:
- "Find me some melancholic songs about lost love"
- "Show me energetic workout music"
- "What songs do I have about summer?"

Expected behavior:
1. See "Searching indexed tracks..." indicator
2. See summary like "Found 8 tracks matching..."
3. Click to expand and see full results
4. Agent presents the tracks naturally in conversation

### 3. Test Tidal Search Tool

In the chat interface, try:
- "What albums does Radiohead have?"
- "Find tracks by Björk"
- "Search for OK Computer"

Expected behavior:
1. See "Searching Tidal..." indicator
2. Results show library/indexed status badges
3. Agent can explore album track listings

### 4. Test Batch Metadata Tool

This is typically used by the agent internally, but you can trigger it:
- "Compare the energy levels of the songs you just found"
- "Tell me more about these tracks"

Expected behavior:
1. Agent retrieves detailed metadata
2. Can compare audio features, lyrics, interpretations

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run only agent tool tests
npm test -- --grep "agentTools"

# Run with coverage
npm test -- --coverage
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tool invocation component tests
npm test -- ToolInvocation
```

## Observability

### Langfuse Dashboard

1. Open http://localhost:3000
2. Login with `admin@localhost.dev` / `adminadmin`
3. Navigate to **algojuke** project
4. View traces with tag `chat`

Each chat request creates a trace containing:
- Generation span for Claude response
- Tool spans for each tool invocation
- Token usage and timing metrics

### Logs

Backend logs include:
- `tool_call_start` - Tool execution begins
- `tool_call_end` - Tool execution completes
- `tool_call_error` - Tool execution failed
- `tool_call_retry` - Retry attempted

```bash
# Follow backend logs
cd backend && npm run dev 2>&1 | grep tool_call
```

## Troubleshooting

### "No tracks found" for semantic search

1. Check Qdrant has indexed tracks
2. Verify embeddings are present: query Qdrant directly
3. Check TEI service is running (if using local embeddings)

### Tidal search fails

1. Check Tidal credentials in `.env`
2. Verify rate limiting isn't blocking requests
3. Check network connectivity to Tidal API

### Tool invocations not streaming

1. Check SSE connection in browser DevTools → Network
2. Verify `Content-Type: text/event-stream` header
3. Check for CORS issues if frontend on different port

### Langfuse traces missing

1. Verify Langfuse keys in `.env`
2. Check Langfuse service is running
3. Call `flushLangfuse()` is being awaited

## File Locations

### Backend

```
backend/src/
├── services/
│   ├── chatStreamService.ts    # Modified: tool execution loop
│   └── agentTools/             # NEW: Tool implementations
│       ├── index.ts
│       ├── semanticSearchTool.ts
│       ├── tidalSearchTool.ts
│       └── batchMetadataTool.ts
├── schemas/
│   └── agentTools.ts           # NEW: Zod schemas
└── types/
    └── agentTools.ts           # NEW: TypeScript types
```

### Frontend

```
frontend/src/
├── components/chat/
│   ├── ChatMessage.tsx         # Modified: render tool blocks
│   └── ToolInvocation.tsx      # NEW: Tool display component
├── hooks/
│   └── useChatStream.ts        # Modified: handle tool events
└── types/
    └── chat.ts                 # Modified: tool event types
```

### Contracts

```
specs/011-agent-tools/contracts/
├── semantic-search-tool.md
├── tidal-search-tool.md
├── batch-metadata-tool.md
└── sse-tool-events.md
```

## Next Steps

After implementation:

1. **Manual Testing**: Use chat interface to test all tools
2. **Integration Tests**: Run `npm test` in backend
3. **Observability Validation**: Check Langfuse for complete traces
4. **Performance Check**: Verify tools complete within targets (3s for searches)
5. **Error Scenarios**: Test with Qdrant/Tidal unavailable
