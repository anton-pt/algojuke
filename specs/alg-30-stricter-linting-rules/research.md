# Research: Implement Stricter Linting Rules

**Date**: 2026-01-08
**Feature**: ALG-30
**Implementation Guidance**: None provided

## Executive Summary

This research documents the patterns required to fix ~289 ESLint errors when enabling strict type-checking rules in the backend. Key decisions cover three main areas: (1) replacing `any` with `unknown` + type guards for error handling, (2) creating an asyncHandler wrapper for Express routes, and (3) properly typing GraphQL union type resolvers.

## Key Decisions

### 1. Error Handler Parameter Types

**Decision**: Replace `any` with `unknown` and use type guards (`instanceof`, custom predicates) for safe property access.

**Rationale**: The services/worker package already uses this pattern successfully. TypeScript 4.0+ infers `unknown` for catch clause variables, and this pattern provides runtime safety while satisfying ESLint's strict rules.

**Pattern**:

```typescript
// Type guard for safe property access
export function isErrorWithMessage(error: unknown): error is Error {
  return error instanceof Error;
}

// In catch blocks
catch (error) {  // error: unknown (TypeScript 4.0+)
  if (error instanceof Error) {
    logger.error("operation_failed", { message: error.message });
  } else {
    logger.error("unknown_error", { error: String(error) });
  }
}

// For PostgreSQL-specific errors
export function isPostgresError(
  error: unknown,
): error is Error & { code?: string; detail?: string } {
  return error instanceof Error;
}
```

**Alternatives Considered**:

- **Keep `any`**: Rejected - defeats the purpose of strict typing
- **Type assertion `as Error`**: Rejected - unsafe if error isn't actually an Error
- **eslint-disable comments**: Rejected - masks the problem rather than fixing it

### 2. Express Async Handler Pattern

**Decision**: Create an `asyncHandler` utility that wraps async route handlers to satisfy `no-misused-promises`.

**Rationale**: Express expects route handlers to return `void`, but async functions return `Promise<void>`. This creates a type mismatch that ESLint flags. A wrapper function converts the async handler to a synchronous handler that properly catches rejections.

**Pattern**:

```typescript
// backend/src/utils/asyncHandler.ts
import { Request, Response, NextFunction } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next?: NextFunction,
) => Promise<void>;

export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage in routes
router.post(
  "/stream",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    // async code here
  }),
);
```

**Alternatives Considered**:

- **eslint-disable on each route**: Rejected - repetitive and masks the issue
- **express-async-handler package**: Rejected - adds dependency for simple utility
- **Make handlers synchronous**: Rejected - impractical for I/O-bound operations

### 3. GraphQL Union Type Resolvers

**Decision**: Define explicit TypeScript union types matching GraphQL schema unions, and use them in `__resolveType` function parameters.

**Rationale**: The codebase already has good examples in `discoveryResolver.ts` and `playlistResolver.ts`. The `library.ts` resolvers use `any` which should be replaced with proper union types.

**Pattern**:

```typescript
// Define union type matching GraphQL schema
type AddAlbumToLibraryResultType =
  | LibraryAlbum
  | DuplicateLibraryItemError
  | TidalApiUnavailableError;

// Use in resolver with explicit return type
AddAlbumToLibraryResult: {
  __resolveType(obj: AddAlbumToLibraryResultType): string {
    return obj.__typename;
  },
},

// For field resolvers, type the parent parameter
LibraryAlbum: {
  createdAt: (parent: LibraryAlbum) => {
    if (!parent.createdAt) return null;
    return parent.createdAt instanceof Date
      ? parent.createdAt.toISOString()
      : parent.createdAt;
  },
},
```

**Alternatives Considered**:

- **Keep `any` with eslint-disable**: Rejected - loses type safety
- **Generic `object` type**: Rejected - too permissive, doesn't help TypeScript
- **Codegen types**: Considered but out of scope - would require graphql-codegen setup

### 4. Unused Imports and Variables

**Decision**: Remove unused imports/exports; prefix intentionally unused parameters with underscore.

**Rationale**: Unused code is dead weight. The underscore prefix convention is already used in the codebase and supported by ESLint's `argsIgnorePattern`.

**Pattern**:

```typescript
// Remove unused imports entirely
// BEFORE
import { TypeA, TypeB, UnusedType } from "./types";
// AFTER
import { TypeA, TypeB } from "./types";

// Prefix intentionally unused parameters
// BEFORE
tracks.map((track, index) => processTrack(track));
// AFTER
tracks.map((track, _index) => processTrack(track));
```

## Implementation Patterns

### Pattern: Safe Error Extraction

From `services/worker/src/clients/anthropic.ts`:

```typescript
catch (error) {
  // Check for custom error by name
  if (error instanceof Error && error.name === "APIError") {
    throw error;
  }

  // Check instanceof Error with message inspection
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || message.includes("429")) {
      throw createAPIError(429, "Anthropic", "Rate limit exceeded");
    }
  }

  // Fallback for unknown error types
  throw createAPIError(
    500,
    "Anthropic",
    error instanceof Error ? error.message : "Unknown error",
  );
}
```

### Pattern: Type Guard for PostgreSQL Errors

New utility for `backend/src/utils/errors.ts`:

```typescript
/**
 * Type guard for PostgreSQL error with code property
 */
export function isPostgresError(
  error: unknown,
): error is Error & { code?: string; errorCode?: string; detail?: string } {
  return error instanceof Error;
}

/**
 * Safely extract error message from unknown value
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
```

### Pattern: Floating Promise Handling

For `backend/src/server.ts`:

```typescript
// BEFORE (triggers no-floating-promises)
startServer();

// AFTER (explicit void operator or .catch())
void startServer();
// OR
startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
```

### Pattern: require-await Fix

```typescript
// BEFORE (triggers require-await)
async function getContext(): Promise<Context> {
  return { user: getCurrentUser() };
}

// AFTER (remove async if not needed)
function getContext(): Context {
  return { user: getCurrentUser() };
}
```

## Files to Modify

### New File

- `backend/src/utils/asyncHandler.ts` - Express async handler wrapper

### ESLint Configs

- `backend/.eslintrc.cjs` - Enable 9 strict rules, upgrade warn→error
- `frontend/.eslintrc.cjs` - Add `recommended-requiring-type-checking`, upgrade warn→error

### Backend High Priority (by error count)

| File                                 | Errors | Primary Pattern                  |
| ------------------------------------ | ------ | -------------------------------- |
| `src/resolvers/library.ts`           | 49     | Union types for \_\_resolveType  |
| `src/services/tidalService.ts`       | 35     | JSON:API type definitions        |
| `src/services/libraryService.ts`     | 26     | error: unknown + type guards     |
| `src/services/chatStreamService.ts`  | 17     | Remove unused imports            |
| `src/services/agentTools/tracing.ts` | 9      | error: unknown + remove unused   |
| `src/utils/errors.ts`                | 8      | error: unknown parameters        |
| `src/routes/auth.ts`                 | 6      | asyncHandler wrapper             |
| `src/services/agentTools/retry.ts`   | 4      | error: unknown                   |
| `src/clients/teiClient.ts`           | 3      | Response type annotations        |
| `src/clients/anthropicClient.ts`     | 2      | Response type annotations        |
| `src/server.ts`                      | 2      | Promise handling + require-await |
| `src/routes/chatRoutes.ts`           | 1      | asyncHandler wrapper             |
| `src/routes/playlists.ts`            | 1      | asyncHandler wrapper             |

### Frontend

| File                                        | Warnings | Fix                              |
| ------------------------------------------- | -------- | -------------------------------- |
| `src/components/chat/SavePlaylistModal.tsx` | 1        | Add missing useEffect dependency |
| `src/contexts/UndoDeleteContext.tsx`        | 2        | Fix useCallback/useEffect deps   |

## External References

- [TypeScript 4.0 Release Notes - Unknown on Catch](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-0.html#unknown-on-catch-clause-bindings)
- [@typescript-eslint/no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises/)
- [Apollo Server Union Types](https://www.apollographql.com/docs/apollo-server/schema/unions-interfaces/#resolving-a-union)
