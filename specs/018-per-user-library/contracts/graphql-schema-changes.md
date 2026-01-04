# GraphQL Schema Changes: Per-User Library

**Feature**: 018-per-user-library
**Date**: 2026-01-04

## Overview

This document describes the GraphQL resolver changes required for per-user library and conversation isolation. The GraphQL schema itself does not change - all changes are in resolver behavior and authentication enforcement.

## Schema (Unchanged)

The existing GraphQL schema already supports the required operations. No type definitions need to change.

```graphql
type Query {
  # Library operations - now user-scoped
  getLibraryAlbums: [LibraryAlbum!]!
  getLibraryTracks: [LibraryTrack!]!
  getLibraryAlbum(id: ID!): LibraryAlbum
  getLibraryTrack(id: ID!): LibraryTrack

  # Chat operations - now user-scoped
  conversations: [Conversation!]!
  conversation(id: ID!): Conversation

  # Search operations - now requires auth
  searchTidal(query: String!, limit: Int): TidalSearchResult!
  discoverSearch(query: String!, limit: Int): [DiscoverSearchResult!]!
}

type Mutation {
  # Library operations - now user-scoped
  addAlbumToLibrary(tidalAlbumId: String!): LibraryAlbum!
  addTrackToLibrary(tidalTrackId: String!): LibraryTrack!
  removeAlbumFromLibrary(id: ID!): Boolean!
  removeTrackFromLibrary(id: ID!): Boolean!

  # Chat operations - now user-scoped
  createConversation: Conversation!
  deleteConversation(id: ID!): Boolean!
}
```

## Resolver Changes

### Authentication Guard

**New File**: `backend/src/middleware/authGuard.ts`

```typescript
import { GraphQLError } from 'graphql';

export interface AuthenticatedContext {
  userId: string;
  // ... other context properties
}

export function requireAuth(context: { userId?: string }): asserts context is AuthenticatedContext {
  if (!context.userId) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
}
```

### Library Resolvers

**File**: `backend/src/resolvers/library.ts`

**Current (Broken)**:
```typescript
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';

const resolvers = {
  Query: {
    getLibraryAlbums: async (_: any, __: any, context: any) => {
      return context.libraryService.getLibraryAlbums(CURRENT_USER_ID);
    },
    // ...
  },
};
```

**Required Change**:
```typescript
import { requireAuth } from '../middleware/authGuard';
import { logSecurityEvent } from '../utils/securityLogger';

const resolvers = {
  Query: {
    getLibraryAlbums: async (_: any, __: any, context: any) => {
      requireAuth(context);
      return context.libraryService.getLibraryAlbums(context.userId);
    },

    getLibraryTracks: async (_: any, __: any, context: any) => {
      requireAuth(context);
      return context.libraryService.getLibraryTracks(context.userId);
    },

    getLibraryAlbum: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      const album = await context.libraryService.getLibraryAlbum(id, context.userId);
      if (!album) {
        // Logs access attempt if item exists but belongs to different user
        // Service layer handles the logging
      }
      return album;
    },

    getLibraryTrack: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      return context.libraryService.getLibraryTrack(id, context.userId);
    },
  },

  Mutation: {
    addAlbumToLibrary: async (_: any, { tidalAlbumId }: { tidalAlbumId: string }, context: any) => {
      requireAuth(context);
      return context.libraryService.addAlbumToLibrary(tidalAlbumId, context.userId);
    },

    addTrackToLibrary: async (_: any, { tidalTrackId }: { tidalTrackId: string }, context: any) => {
      requireAuth(context);
      return context.libraryService.addTrackToLibrary(tidalTrackId, context.userId);
    },

    removeAlbumFromLibrary: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      return context.libraryService.removeAlbumFromLibrary(id, context.userId);
    },

    removeTrackFromLibrary: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      return context.libraryService.removeTrackFromLibrary(id, context.userId);
    },
  },
};
```

### Chat Resolvers

**File**: `backend/src/resolvers/chatResolver.ts`

**Required Change**:
```typescript
import { requireAuth } from '../middleware/authGuard';

const resolvers = {
  Query: {
    conversations: async (_: any, __: any, context: any) => {
      requireAuth(context);
      return context.chatService.getConversations(context.userId);
    },

    conversation: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      // Service returns null if conversation doesn't exist OR belongs to different user
      return context.chatService.getConversation(id, context.userId);
    },
  },

  Mutation: {
    createConversation: async (_: any, __: any, context: any) => {
      requireAuth(context);
      return context.chatService.createConversation(context.userId);
    },

    deleteConversation: async (_: any, { id }: { id: string }, context: any) => {
      requireAuth(context);
      // Service verifies ownership before deletion
      return context.chatService.deleteConversation(id, context.userId);
    },
  },
};
```

### Search Resolvers

**File**: `backend/src/resolvers/search.ts` (or equivalent)

All search operations now require authentication:

```typescript
import { requireAuth } from '../middleware/authGuard';

const resolvers = {
  Query: {
    searchTidal: async (_: any, args: any, context: any) => {
      requireAuth(context);
      return context.tidalService.search(args.query, args.limit, context.userId);
    },

    discoverSearch: async (_: any, args: any, context: any) => {
      requireAuth(context);
      return context.discoveryService.search(args.query, args.limit, context.userId);
    },
  },
};
```

## Error Responses

### Authentication Error (401 Equivalent)

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ],
  "data": null
}
```

### Authorization Error (403 Equivalent)

When a user tries to access another user's data (e.g., via ID guessing), the resolver returns `null` rather than throwing an error. This prevents information leakage about whether the resource exists.

```json
{
  "data": {
    "getLibraryAlbum": null
  }
}
```

The access attempt is logged server-side for security monitoring.

## Service Layer Contracts

### LibraryService

All methods now require userId parameter:

```typescript
interface LibraryService {
  getLibraryAlbums(userId: string): Promise<LibraryAlbum[]>;
  getLibraryTracks(userId: string): Promise<LibraryTrack[]>;
  getLibraryAlbum(id: string, userId: string): Promise<LibraryAlbum | null>;
  getLibraryTrack(id: string, userId: string): Promise<LibraryTrack | null>;
  addAlbumToLibrary(tidalAlbumId: string, userId: string): Promise<LibraryAlbum>;
  addTrackToLibrary(tidalTrackId: string, userId: string): Promise<LibraryTrack>;
  removeAlbumFromLibrary(id: string, userId: string): Promise<boolean>;
  removeTrackFromLibrary(id: string, userId: string): Promise<boolean>;

  // For agent tools - check library membership
  getLibraryIsrcs(userId: string): Promise<Set<string>>;
  isAlbumInLibrary(tidalAlbumId: string, userId: string): Promise<boolean>;
  isTrackInLibrary(tidalTrackId: string, userId: string): Promise<boolean>;
}
```

### ChatService

All methods now require userId parameter (remove DEFAULT_USER_ID fallback):

```typescript
interface ChatService {
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | null>;
  createConversation(userId: string): Promise<Conversation>;
  createConversationWithMessage(message: string, userId: string): Promise<Conversation>;
  deleteConversation(id: string, userId: string): Promise<boolean>;
  addMessage(conversationId: string, role: string, content: any, userId: string): Promise<Message>;
}
```

## Agent Tool Context

### Semantic Search Tool

```typescript
interface SemanticSearchContext {
  userId: string;  // Required, no fallback
  // ... other context
}

// Tool implementation
async function semanticSearchTool(input: SemanticSearchInput, context: SemanticSearchContext) {
  // userId is required - throws if missing
  if (!context.userId) {
    throw new Error('User context required for semantic search');
  }

  // Check library status for current user
  const libraryIsrcs = await getLibraryIsrcs(context.userId);

  // ... search logic with user-specific library flags
}
```

### Tidal Search Tool

```typescript
interface TidalSearchContext {
  userId: string;  // Required, no fallback
  // ... other context
}
```

### Batch Metadata Tool

```typescript
interface BatchMetadataContext {
  userId: string;  // Required, no fallback
  // ... other context
}
```

## Frontend Integration

### Apollo Client Configuration

**File**: `frontend/src/lib/apollo.ts`

Ensure auth token is included in all requests:

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const authLink = setContext(async (_, { headers }) => {
  // Get Clerk token
  const token = await getToken();

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

### Error Handling

Handle UNAUTHENTICATED errors by redirecting to sign-in:

```typescript
import { onError } from '@apollo/client/link/error';

const errorLink = onError(({ graphQLErrors }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      if (err.extensions?.code === 'UNAUTHENTICATED') {
        // Redirect to sign-in
        window.location.href = '/sign-in';
      }
    }
  }
});
```
