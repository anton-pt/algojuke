# Research: Expose Agent Tools via GraphQL API

**Date**: 2026-01-13
**Feature**: ALG-77
**Implementation Guidance**: None (standard patterns)

## Executive Summary

Expose four agent tools (semanticSearch, tidalSearch, albumTracks, batchMetadata) via GraphQL queries with dual authentication: Clerk user auth and service API key. Follow existing union type pattern from library resolvers for error handling. Build tool context from GraphQL context with explicit service/repository injection.

## Key Decisions

### 1. Service Auth Header Extraction

**Decision**: Extract `X-API-Key` header in Apollo Server context builder alongside Clerk auth.

**Rationale**: Context builder is the single place where all request metadata is captured. Adding `serviceApiKey` here keeps auth logic centralized and allows resolvers to check either auth mode.

**Alternatives Considered**:

- Express middleware before GraphQL: Rejected - would require passing auth state through separate mechanism
- Per-resolver header extraction: Rejected - duplicated code, inconsistent pattern

**Pattern** (from `server.ts:252-274`):

```typescript
context: ({ req }) => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? undefined;
  const serviceApiKey = req.headers["x-api-key"] as string | undefined;

  return Promise.resolve({
    // ... existing services
    userId,
    serviceApiKey,
  });
};
```

### 2. Context Type Extension

**Decision**: Add `serviceApiKey?: string` to `GraphQLContext` interface in `authGuard.ts`.

**Rationale**: Minimal change - just extends existing interface. All resolvers already receive this context type.

**Pattern** (from `authGuard.ts:22-26`):

```typescript
export interface GraphQLContext {
  userId?: string;
  serviceApiKey?: string; // NEW
  [key: string]: unknown;
}
```

### 3. Resolver Error Handling Pattern

**Decision**: Use union types with `__typename` discriminator (same as library resolvers), not thrown errors.

**Rationale**:

- Consistent with existing `AddAlbumToLibraryResult` pattern
- Enables typed error responses with `retryable` flag
- Client can handle all cases without try/catch
- Better GraphQL introspection support

**Alternatives Considered**:

- Throw `GraphQLError`: Rejected - loses typed error details, inconsistent with library pattern
- Return `{ success, error }` wrapper: Rejected - non-idiomatic GraphQL

**Pattern** (from `library.ts:131-176`):

```typescript
// Success case
return {
  __typename: "SemanticSearchResponse",
  ...result,
};

// Error case
return {
  __typename: "AgentToolError",
  message: error.message,
  code: mapErrorCode(error),
  retryable: error.retryable ?? false,
};
```

### 4. Tool Executor Invocation

**Decision**: Build tool context objects inside resolvers from GraphQL context properties.

**Rationale**: Tool executors require specific context interfaces (e.g., `SemanticSearchContext`). GraphQL context has all needed services; resolvers just restructure them.

**Pattern**:

```typescript
// In resolver
const toolContext: SemanticSearchContext = {
  discoveryService: context.discoveryService,
  trackMetadataService: context.trackMetadataService,
  libraryTrackRepository: context.dataSources.db.getRepository(LibraryTrack),
  libraryAlbumRepository: context.dataSources.db.getRepository(LibraryAlbum),
  userId: resolvedUserId,
};

const result = await executeSemanticSearch(input, toolContext);
```

### 5. Error Code Mapping

**Decision**: Map `ToolError.code` strings to GraphQL enum values directly.

**Rationale**: Existing tool errors already use string codes ("RATE_LIMIT", "NOT_FOUND", "VALIDATION_ERROR"). GraphQL enum provides type safety.

**Pattern**:

```typescript
enum AgentToolErrorCode {
  VALIDATION_ERROR
  NOT_FOUND
  RATE_LIMIT
  TIMEOUT
  INTERNAL_ERROR
  UNAUTHENTICATED
}

function mapErrorCode(error: ToolError): AgentToolErrorCode {
  switch (error.code) {
    case "VALIDATION_ERROR": return "VALIDATION_ERROR";
    case "NOT_FOUND": return "NOT_FOUND";
    case "RATE_LIMIT": return "RATE_LIMIT";
    case "TIMEOUT": return "TIMEOUT";
    default: return "INTERNAL_ERROR";
  }
}
```

## Implementation Patterns

### Service Auth Middleware

New file `backend/src/middleware/serviceAuth.ts`:

```typescript
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

export function isServiceAuthenticated(apiKey: string | undefined): boolean {
  if (!SERVICE_API_KEY) {
    logger.warn("service_auth_not_configured");
    return false;
  }
  return apiKey === SERVICE_API_KEY;
}

export function resolveAgentToolUserId(
  context: { userId?: string; serviceApiKey?: string },
  inputUserId: string | undefined | null,
  operationName: string,
): string {
  const isService = isServiceAuthenticated(context.serviceApiKey);

  if (isService) {
    if (!inputUserId) {
      throw new GraphQLError("userId required for service auth", {
        extensions: { code: "UNAUTHENTICATED" },
      });
    }
    return inputUserId;
  }

  // User auth: use context userId
  if (!context.userId) {
    throw new GraphQLError("Authentication required", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.userId;
}
```

### Resolver Structure

```typescript
export const agentToolsResolvers = {
  Query: {
    agentSemanticSearch: async (
      _parent: unknown,
      args: { input: SemanticSearchGraphQLInput },
      context: AgentToolsContext,
    ): Promise<SemanticSearchResult> => {
      const startTime = Date.now();

      try {
        const userId = resolveAgentToolUserId(
          context,
          args.input.userId,
          "agentSemanticSearch",
        );

        const toolContext: SemanticSearchContext = {
          discoveryService: context.discoveryService,
          trackMetadataService: context.trackMetadataService,
          libraryTrackRepository:
            context.dataSources.db.getRepository(LibraryTrack),
          libraryAlbumRepository:
            context.dataSources.db.getRepository(LibraryAlbum),
          userId,
        };

        const result = await executeSemanticSearch(
          { query: args.input.query, limit: args.input.limit ?? 50 },
          toolContext,
        );

        return {
          __typename: "SemanticSearchResponse",
          ...result,
        };
      } catch (error) {
        return mapToolErrorToGraphQL(error, "agentSemanticSearch");
      }
    },
  },

  // Union type resolver
  SemanticSearchResult: {
    __resolveType(obj: { __typename: string }) {
      return obj.__typename;
    },
  },
};
```

### Tool Context Requirements

| Tool                    | Context Services                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `executeSemanticSearch` | discoveryService, trackMetadataService, libraryTrackRepository, libraryAlbumRepository, userId |
| `executeTidalSearch`    | tidalService, qdrantClient, libraryTrackRepository, libraryAlbumRepository, userId             |
| `executeAlbumTracks`    | tidalService, qdrantClient, libraryTrackRepository, libraryAlbumRepository, userId             |
| `executeBatchMetadata`  | qdrantClient, libraryTrackRepository, libraryAlbumRepository, userId                           |

## Files to Modify

| File                                          | Changes                                                           |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `backend/src/middleware/serviceAuth.ts`       | **Create** - `isServiceAuthenticated`, `resolveAgentToolUserId`   |
| `backend/src/middleware/authGuard.ts`         | Add `serviceApiKey?: string` to `GraphQLContext`                  |
| `backend/src/schema/agentTools.graphql`       | **Create** - Input types, output types, union types, queries      |
| `backend/src/resolvers/agentToolsResolver.ts` | **Create** - 4 query resolvers + union type resolvers             |
| `backend/src/server.ts`                       | Extract X-API-Key header in context, merge resolvers, load schema |
| `deploy/cloudrun/backend.yaml`                | Add SERVICE_API_KEY env var                                       |
| `deploy/cloudrun/worker.yaml`                 | Add BACKEND_API_URL + SERVICE_API_KEY env vars                    |

## GraphQL Schema Structure

```graphql
# Input with optional userId for dual auth
input SemanticSearchInput {
  query: String!
  limit: Int = 50
  userId: String # Required for service auth, ignored for user auth
}

# Response types matching TypeScript
type SemanticSearchResponse {
  tracks: [OptimizedTrackResult!]!
  query: String!
  totalFound: Int!
  summary: String!
  durationMs: Int!
}

# Unified error type
type AgentToolError {
  message: String!
  code: AgentToolErrorCode!
  retryable: Boolean!
}

# Union for typed responses
union SemanticSearchResult = SemanticSearchResponse | AgentToolError

# Query with union return type
extend type Query {
  agentSemanticSearch(input: SemanticSearchInput!): SemanticSearchResult!
}
```
