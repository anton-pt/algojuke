# ALG-86: Chat Agent Integration for Radio Mixes

## Summary

Wire readwiseList, readwiseFetch, and generateMix tools into the existing Discover chat agent to enable radio mix creation from conversation. This is the final ticket of Radio Station Phase 1 that integrates all backend infrastructure.

## Dependencies

- **ALG-82**: Readwise Agent Tools (readwiseList, readwiseFetch implementations)
- **ALG-83**: GenerateMix Agent Tool (generateMix implementation)
- **ALG-81**: Mix GraphQL API (MixService for creating mix entities)
- **ALG-85**: Inngest mixGeneration Function (background processing)

## Architecture

### Tool Registration

The chat agent now has 8 tools available:

| Tool            | Purpose                              | Source |
| --------------- | ------------------------------------ | ------ |
| semanticSearch  | Search indexed library by mood/theme | ALG-15 |
| tidalSearch     | Search Tidal catalogue               | ALG-15 |
| albumTracks     | Get tracks from a Tidal album        | ALG-15 |
| batchMetadata   | Get full metadata for ISRCs          | ALG-15 |
| suggestPlaylist | Present curated playlist visually    | ALG-19 |
| readwiseList    | List user's Readwise documents       | ALG-82 |
| readwiseFetch   | Fetch document content               | ALG-82 |
| generateMix     | Trigger background mix generation    | ALG-83 |

### Tool Context Flow

```
ChatStreamService
  └── createTools(context: ToolContext)
        ├── discoveryService     → semanticSearch
        ├── tidalService         → tidalSearch, albumTracks
        ├── trackMetadataService → batchMetadata
        ├── userId               → suggestPlaylist, readwiseList, readwiseFetch, generateMix
        ├── mixService           → generateMix
        └── conversationId       → generateMix (links mix to conversation)
```

## User Stories

### US-1: Explore Readwise Queue (P1)

**As** a user
**I want** to ask the chat agent about my saved articles
**So that** I can plan a radio mix from my reading queue

**Acceptance Criteria:**

- Agent uses `readwiseList` when user asks about their articles
- Supports filtering by location (new, later, archive)
- Supports filtering by category (article, email, pdf)
- Supports filtering by tags
- Returns document metadata (title, author, word count, reading time)

### US-2: Preview Article Content (P1)

**As** a user
**I want** to see a summary of an article before including it
**So that** I can make informed decisions about mix content

**Acceptance Criteria:**

- Agent uses `readwiseFetch` to get article details
- Supports summary mode (optimized for spoken audio)
- Supports full mode (complete extracted text)
- Adjustable summary length (short/medium/long)

### US-3: Generate Radio Mix (P1)

**As** a user
**I want** to create a radio mix from selected articles
**So that** I can listen to my reading queue as audio content

**Acceptance Criteria:**

- Agent confirms article selection before generation
- Agent asks for mix title and preferences
- Agent can accept music instructions for the DJ agent
- Mix generation starts in background via Inngest
- Agent informs user to track progress in Radio section

### US-4: Conversational Workflow (P2)

**As** a user
**I want** the agent to guide me through mix creation
**So that** the process feels natural and conversational

**Acceptance Criteria:**

- Agent follows documented workflow in system prompt
- Agent asks clarifying questions about article preferences
- Agent suggests content modes based on article length
- Agent provides feedback on mix generation status

## Technical Design

### Modified Files

| File                            | Change                                   |
| ------------------------------- | ---------------------------------------- |
| `services/agentTools/index.ts`  | Export readwiseList, readwiseFetch       |
| `routes/chatRoutes.ts`          | Add mixService to route options          |
| `services/chatStreamService.ts` | Register 3 new tools, extend ToolContext |
| `prompts/chatSystemPrompt.ts`   | Add tool docs and radio mix workflow     |
| `server.ts`                     | Pass mixService to createChatRoutes      |

### ToolContext Interface

```typescript
interface ToolContext {
  discoveryService: DiscoveryService;
  trackMetadataService: TrackMetadataService;
  tidalService: TidalService;
  mixService: MixService; // NEW
  qdrantClient: BackendQdrantClient;
  libraryTrackRepository: Repository<LibraryTrack>;
  libraryAlbumRepository: Repository<LibraryAlbum>;
  userId: string;
  conversationId?: string; // NEW
  onEvent: (event: SSEEvent) => void;
  trace: DiscoveryTrace | null;
  toolCallsMap: Map<string, { name: string; input: unknown }>;
  toolResultsMap: Map<string, unknown>;
}
```

### System Prompt Additions

#### Tool Documentation

```markdown
### readwiseList

List documents from user's Readwise Reader queue.

- Filters: location, category, tags, limit
- Returns: id, title, author, source, wordCount, readingTimeMinutes

### readwiseFetch

Fetch and process document content.

- Parameters: documentId, contentMode (summary/full), summaryLength
- Returns: document metadata, processed content

### generateMix

Trigger background mix generation.

- Parameters: title, articles[], description?, musicInstructions?
- Returns: mixId, status ("generating")
```

#### Workflow Section

```markdown
### Creating Radio Mixes

1. Explore queue with readwiseList
2. Discuss article selection
3. Determine content preferences (mode, title, music)
4. Preview if needed with readwiseFetch
5. Confirm and generate with generateMix
```

### Tool Registration Pattern

Each tool follows the established pattern:

```typescript
const tool = tool({
  description: "...",
  inputSchema: Schema,
  execute: async (input, options) => {
    // 1. Track tool call for persistence
    context.toolCallsMap.set(toolCallId, { name, input });

    // 2. Emit start event
    context.onEvent({ type: "tool_call_start", ... });

    // 3. Create tracing span
    const span = createToolSpan(context.trace, { ... });

    // 4. Execute with retry (or direct for one-shot tools)
    const result = await executeToolFunction(input, toolContext);

    // 5. Track result and emit end event
    context.toolResultsMap.set(toolCallId, result);
    context.onEvent({ type: "tool_call_end", ... });

    return result;
  },
});
```

## Testing

### Contract Tests

File: `tests/contract/agentTools/chatAgentRadioMix.test.ts`

| Test                         | Validates                                |
| ---------------------------- | ---------------------------------------- |
| ToolName enum includes tools | readwiseList, readwiseFetch, generateMix |
| Total tool count             | 8 tools registered                       |
| System prompt tool docs      | All 3 new tools documented               |
| System prompt workflow       | Radio mix workflow section present       |

### Existing Tool Tests

The individual tool implementations have their own tests:

- `readwiseListTool.test.ts` - Schema validation, output structure
- `readwiseFetchTool.test.ts` - Schema validation, content modes
- `generateMixTool.test.ts` - Schema validation, article limits

## Verification Checklist

- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm test` passes (948 tests)
- [x] New tools appear in createTools() return object
- [x] System prompt includes all 8 tools
- [x] generateMix correctly receives conversationId
- [x] mixService injected into ToolContext

## Out of Scope

- Frontend Radio screen (separate ticket)
- DJ agent implementation (ALG-85, already done)
- Inngest function testing (already tested in worker)
- End-to-end with real Inngest Dev Server (mock-based testing)

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Agent tools architecture
- [ALG-82 Spec](../alg-82-readwise-agent-tools/) - Readwise tool implementations
- [ALG-83 Spec](../alg-83-generatemix-agent-tool/) - GenerateMix tool implementation
- [ALG-85 Spec](../alg-85-inngest-mixgeneration-function/spec.md) - DJ agent pipeline
