# Data Model: Clerk Authentication with Tidal Account Connection

**Date**: 2026-01-03
**Feature**: 016-clerk-tidal-auth

## Overview

This feature does not introduce new database entities. User identity is managed by Clerk, and Tidal connection data is stored in Clerk's private metadata. The allowlist is a static configuration file.

## Entities

### User (Clerk-Managed)

User identity is fully managed by Clerk. We access user data via Clerk's API.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | string | Clerk | Unique user identifier (e.g., `user_xxx`) |
| `emailAddresses` | EmailAddress[] | Clerk | User's email addresses |
| `primaryEmailAddress` | EmailAddress | Clerk | Primary email for identification |
| `privateMetadata` | object | Clerk | Backend-only metadata (stores Tidal tokens) |
| `publicMetadata` | object | Clerk | Frontend-readable metadata |

**Access Pattern**:
```typescript
// Backend access
import { clerkClient, getAuth } from '@clerk/express';

const { userId } = getAuth(req);
const user = await clerkClient.users.getUser(userId);
const email = user.primaryEmailAddress?.emailAddress;
```

---

### TidalTokens (Clerk Private Metadata)

Stored in `user.privateMetadata.tidal`.

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | string | Tidal OAuth access token |
| `refreshToken` | string | Tidal OAuth refresh token |
| `expiresAt` | number | Token expiration (Unix timestamp ms) |
| `scopes` | string[] | Granted OAuth scopes |
| `connectedAt` | number | Connection timestamp (Unix ms) |

**Validation Rules**:
- `accessToken`: Required, non-empty string
- `refreshToken`: Required, non-empty string
- `expiresAt`: Required, positive number, must be in the future when stored
- `scopes`: Required, non-empty array of strings
- `connectedAt`: Required, positive number

**TypeScript Schema**:
```typescript
import { z } from 'zod';

export const TidalTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().positive(),
  scopes: z.array(z.string()).min(1),
  connectedAt: z.number().positive(),
});

export type TidalTokens = z.infer<typeof TidalTokensSchema>;
```

**Storage Pattern**:
```typescript
// Store tokens
await clerkClient.users.updateUserMetadata(userId, {
  privateMetadata: {
    tidal: {
      accessToken: '...',
      refreshToken: '...',
      expiresAt: Date.now() + 86400000,
      scopes: ['collection.read', 'playlists.read', ...],
      connectedAt: Date.now(),
    },
  },
});

// Retrieve tokens
const user = await clerkClient.users.getUser(userId);
const tidalTokens = user.privateMetadata?.tidal as TidalTokens | undefined;
```

---

### Allowlist (Static Configuration)

Hardcoded in `backend/src/config/allowlist.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `APPROVED_EMAILS` | readonly string[] | List of approved Google email addresses |

**Validation Rules**:
- Emails must be lowercase
- Emails must be valid email format
- At least one email must exist

**Implementation**:
```typescript
// backend/src/config/allowlist.ts
export const APPROVED_EMAILS = [
  'anton.tcholakov@gmail.com',
] as const;

export type ApprovedEmail = typeof APPROVED_EMAILS[number];

export function isApprovedUser(email: string): boolean {
  return APPROVED_EMAILS.includes(
    email.toLowerCase() as ApprovedEmail
  );
}
```

---

## State Transitions

### User Auth State

```
┌─────────────┐
│ Unauthenticated │
└──────┬──────┘
       │ Sign in with Google
       ▼
┌─────────────┐     Not on allowlist    ┌──────────┐
│ Authenticated │ ─────────────────────▶ │ Waitlist │
└──────┬──────┘                         └──────────┘
       │ On allowlist
       ▼
┌─────────────┐
│ Approved    │ (no Tidal connection)
└──────┬──────┘
       │ Complete Tidal OAuth
       ▼
┌─────────────┐
│ Connected   │ (full access)
└─────────────┘
```

### State Checks

| State | isSignedIn | isApproved | hasTidal | Access Level |
|-------|------------|------------|----------|--------------|
| Unauthenticated | ❌ | - | - | Landing page only |
| Authenticated (not approved) | ✅ | ❌ | - | Waitlist page |
| Approved (no Tidal) | ✅ | ✅ | ❌ | Tidal connect page |
| Connected | ✅ | ✅ | ✅ | Full application |
| Token Refresh Failed | ✅ | ✅ | ❌* | Tidal connect page (with error) |

*Note: When token refresh fails, `hasTidal` becomes `false` (tokens are invalidated). User is redirected to Tidal connect page with an error message explaining they need to reconnect.

---

## Relationships

```
┌─────────────────────────────────────────────────┐
│                   Clerk                          │
│  ┌───────────────────────────────────────────┐  │
│  │               User                         │  │
│  │  - id                                      │  │
│  │  - primaryEmailAddress                     │  │
│  │  - privateMetadata ─────┐                  │  │
│  └─────────────────────────┼─────────────────┘  │
│                            │                     │
│                            ▼                     │
│  ┌───────────────────────────────────────────┐  │
│  │         TidalTokens (embedded)             │  │
│  │  - accessToken                             │  │
│  │  - refreshToken                            │  │
│  │  - expiresAt                               │  │
│  │  - scopes                                  │  │
│  │  - connectedAt                             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              Static Config                       │
│  ┌───────────────────────────────────────────┐  │
│  │             Allowlist                      │  │
│  │  - APPROVED_EMAILS[]                       │  │
│  │  - isApprovedUser(email)                   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Data Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Clerk private metadata size | 8KB max | Clerk platform limit |
| Typical token payload | ~1KB | Well within limit |
| Tidal access token TTL | 24 hours | Per Tidal OAuth spec |
| Tidal refresh token TTL | Variable | Depends on user activity |

---

## No Database Migrations Required

This feature does not require any PostgreSQL schema changes. All auth data is managed externally:
- User identity → Clerk
- Tidal tokens → Clerk private metadata
- Allowlist → Static TypeScript configuration
