# Agent Tools

Feature: 011-agent-tools

This directory contains tool implementations for the Discover Chat agent. Each tool provides a specific capability that the AI agent can invoke during conversations to help users discover and explore music.

## Tools

### Semantic Search Tool (`semanticSearchTool.ts`)

Searches the vector index for tracks matching a natural language query. Uses hybrid search (vector similarity + BM25) to find thematically relevant tracks based on mood, theme, or characteristics.

**Input**: `SemanticSearchInput`
- `query` (string, required): Natural language description of desired music
- `limit` (number, optional): Max results (default: 50, max: 50)

**Output**: `SemanticSearchOutput`
- `tracks[]`: Matching tracks with full metadata, relevance scores, and library status
- `summary`: Human-readable result summary

### Tidal Search Tool (`tidalSearchTool.ts`)

Searches the Tidal catalogue for artists, albums, or tracks. Returns results with library membership and vector index ingestion status flags.

**Input**: `TidalSearchInput`
- `query` (string, required): Search text
- `type` (enum, optional): "tracks" | "albums" | "both" (default: "both")
- `limit` (number, optional): Max results (default: 20, max: 100)

**Output**: `TidalSearchOutput`
- `tracks[]`: Track results with metadata, library status, and indexing status
- `albums[]`: Album results with metadata and library status
- `summary`: Human-readable result summary

### Album Tracks Tool (`albumTracksTool.ts`)

Retrieves the complete track listing for a specific album by Tidal album ID. Each track includes library membership and indexing status.

**Input**: `AlbumTracksInput`
- `albumId` (number, required): Tidal album ID

**Output**: `AlbumTracksOutput`
- `albumTitle`: Album name
- `albumArtist`: Album artist
- `tracks[]`: All tracks on the album with metadata and status flags
- `summary`: Human-readable result summary

### Batch Metadata Tool (`batchMetadataTool.ts`)

Retrieves full metadata for multiple tracks by ISRC from the vector index. Efficient for evaluating multiple candidate tracks when building playlists.

**Input**: `BatchMetadataInput`
- `isrcs` (string[], required): List of ISRCs (max 100)

**Output**: `BatchMetadataOutput`
- `tracks[]`: Found tracks with complete metadata (lyrics, interpretation, audio features)
- `found[]`: ISRCs that were found in the index
- `notFound[]`: ISRCs that were not found
- `summary`: Human-readable result summary

## Supporting Modules

### Retry Logic (`retry.ts`)

Provides automatic retry handling for transient failures:
- `executeWithRetry<T>()`: Wraps tool execution with single automatic retry
- `isRetryableError()`: Determines if an error is transient
- `getUserFriendlyMessage()`: Converts errors to user-facing messages

### Tracing (`tracing.ts`)

Langfuse integration for observability:
- `createToolSpan()`: Creates traced spans for tool invocations
- `executeToolWithTracing()`: Executes tools with automatic span management

## Usage

Tools are registered with the Vercel AI SDK in `chatStreamService.ts`:

```typescript
import { executeSemanticSearch, type SemanticSearchContext } from './agentTools/index.js';

const tools = {
  semanticSearch: tool({
    description: 'Search indexed tracks by mood, theme, or characteristics',
    parameters: SemanticSearchInputSchema,
    execute: async (input) => {
      return executeWithRetry(() => executeSemanticSearch(input, context));
    },
  }),
};
```

## Error Handling

All tools throw `ToolError` on failure:

```typescript
interface ToolError extends Error {
  retryable: boolean;
  userVisible: boolean;
  code: 'VALIDATION_ERROR' | 'SERVICE_UNAVAILABLE' | 'NOT_FOUND' | 'INTERNAL_ERROR';
}
```

The retry wrapper handles `retryable: true` errors automatically.

## Testing

Contract tests are in `tests/contract/agentTools/`:

```bash
npm test -- --grep "agentTools"
```

## Related

- `schemas/agentTools.ts`: Zod input/output schemas
- `types/agentTools.ts`: TypeScript type definitions
- `chatStreamService.ts`: Tool registration and agent configuration
