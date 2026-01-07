# Research: Clerk Authentication with Tidal Account Connection

**Date**: 2026-01-03
**Feature**: 016-clerk-tidal-auth

## Research Questions

### 1. Clerk Integration Pattern

**Question**: How to integrate Clerk with the existing Express/Apollo backend and React frontend?

**Decision**: Use `@clerk/express` for backend middleware and `@clerk/clerk-react` for frontend components.

**Rationale**:
- Clerk officially supports Express.js with dedicated SDK (`@clerk/express`)
- `clerkMiddleware()` attaches auth state to requests automatically
- `requireAuth()` middleware protects routes with automatic redirect
- `@clerk/clerk-react` provides `<ClerkProvider>`, `<SignedIn>`, `<SignedOut>`, `<SignInButton>`, `<UserButton>` components
- Backend can access user data via `clerkClient.users.getUser(userId)`

**Alternatives Considered**:
- `@clerk/clerk-sdk-node` (deprecated, EOL January 2025)
- Custom JWT validation (unnecessary complexity, loses Clerk features)

**Sources**:
- [Clerk Express Quickstart](https://clerk.com/docs/quickstarts/express)
- [Clerk React Quickstart](https://clerk.com/docs/quickstarts/react)

---

### 2. Tidal SDK Authorization Code Flow

**Question**: How to implement Tidal OAuth in the browser using their SDK?

**Decision**: Use `@tidal-music/auth` package with authorization code flow in the frontend.

**Rationale**:
- SDK handles PKCE automatically (required by Tidal/OAuth 2.1)
- Three-step flow: `init()` → `initializeLogin()` → `finalizeLogin()`
- SDK manages token refresh internally via `credentialsProvider.getCredentials()`
- Requires HTTPS (secure context) for OAuth redirects
- Browser-based SDK cannot run on backend (requires browser context)

**Implementation Pattern**:
```typescript
import { init, initializeLogin, finalizeLogin, credentialsProvider } from '@tidal-music/auth';

// 1. Initialize SDK
init({
  clientId: TIDAL_CLIENT_ID,
  credentialsStorageKey: 'tidal-auth'
});

// 2. Start login (returns URL to open)
const loginUrl = await initializeLogin({ redirectUri: CALLBACK_URL });
window.location.href = loginUrl;

// 3. After redirect, finalize (in callback page)
await finalizeLogin(window.location.href);

// 4. Get credentials (call each time, SDK handles refresh)
const credentials = await credentialsProvider.getCredentials();
```

**Alternatives Considered**:
- Backend OAuth implementation (rejected - SDK designed for browser)
- Manual PKCE implementation (rejected - SDK handles this)

**Sources**:
- [Tidal Auth SDK Documentation](https://tidal-music.github.io/tidal-sdk-web/modules/_tidal-music_auth.html)
- [Tidal Developer Portal - Authorization](https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization)

---

### 3. Token Storage Strategy

**Question**: Where to store Tidal access/refresh tokens?

**Decision**: Store in Clerk's private metadata via backend API.

**Rationale**:
- Private metadata is backend-only (never exposed to frontend)
- Encrypted at rest by Clerk
- 8KB limit sufficient for OAuth tokens (~1KB typically)
- Centralized with user identity (no separate database table)
- Access via `clerkClient.users.updateUserMetadata()` and `user.privateMetadata`

**Token Structure**:
```typescript
interface TidalTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // Unix timestamp
  scopes: string[];
}
```

**Flow**:
1. Frontend completes Tidal OAuth, gets tokens from SDK
2. Frontend sends tokens to backend endpoint
3. Backend stores in Clerk private metadata
4. Backend retrieves tokens when making Tidal API calls

**Alternatives Considered**:
- PostgreSQL table (rejected - duplicates auth storage, adds schema)
- Clerk session token claims (rejected - 1.2KB limit, exposed in JWT)
- Frontend localStorage (rejected - security risk, not accessible by backend)

**Sources**:
- [Clerk User Metadata](https://clerk.com/docs/users/metadata)

---

### 4. Allowlist Enforcement

**Question**: How to implement the approved user allowlist?

**Decision**: Hardcoded TypeScript array in `backend/src/config/allowlist.ts`.

**Rationale**:
- Simplest approach for single-user beta
- Type-safe, easy to extend
- No environment variable parsing complexity
- Clear audit trail in version control
- Backend-only check (cannot be bypassed)

**Implementation**:
```typescript
// backend/src/config/allowlist.ts
export const APPROVED_EMAILS = [
  'anton.tcholakov@gmail.com',
] as const;

export function isApprovedUser(email: string): boolean {
  return APPROVED_EMAILS.includes(email.toLowerCase() as typeof APPROVED_EMAILS[number]);
}
```

**Enforcement Points**:
1. After Google sign-in: Check email against allowlist
2. Before Tidal connection: Verify approved status
3. On protected routes: Verify approved + Tidal connected

**Alternatives Considered**:
- Environment variable (rejected - harder for multiple emails)
- Database table (rejected - overkill for beta)
- Clerk user roles/permissions (rejected - requires Clerk Organizations)

---

### 5. Route Protection Strategy

**Question**: How to protect routes based on auth state?

**Decision**: Three-tier protection with React Router and backend middleware.

**Tiers**:
1. **Public**: Landing page (unauthenticated access)
2. **Authenticated + Approved**: Tidal connection page
3. **Fully Connected**: Main application

**Frontend Protection**:
```typescript
// ProtectedRoute.tsx
function ProtectedRoute({ requireTidal, children }) {
  const { isSignedIn, user } = useUser();
  const { hasTidalConnection } = useTidalAuth();

  if (!isSignedIn) return <Navigate to="/" />;
  if (!isApproved(user.email)) return <Navigate to="/waitlist" />;
  if (requireTidal && !hasTidalConnection) return <Navigate to="/connect-tidal" />;
  return children;
}
```

**Backend Protection**:
- `requireAuth()` middleware on all API routes
- Custom middleware to verify allowlist status
- Tidal token endpoints require approved user

---

### 6. OAuth Callback Handling

**Question**: How to handle the Tidal OAuth callback?

**Decision**: Dedicated callback page that finalizes OAuth and stores tokens.

**Flow**:
1. Tidal redirects to `/auth/tidal/callback?code=...`
2. CallbackPage calls `finalizeLogin(url)`
3. Gets credentials via `credentialsProvider.getCredentials()`
4. Sends tokens to backend via authenticated POST
5. Backend stores in Clerk private metadata
6. Redirects to main application

**Error Handling**:
- OAuth cancelled: Show message, offer retry
- OAuth failed: Show error, offer retry
- Backend storage failed: Show error, tokens remain in SDK

---

## Dependencies

### New Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@clerk/express` | ^3.x | Backend Clerk middleware |
| `@clerk/backend` | ^1.x | Backend Clerk client |
| `@clerk/clerk-react` | ^5.x | Frontend Clerk components |
| `@tidal-music/auth` | ^1.4.0 | Tidal OAuth SDK |

### Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `CLERK_PUBLISHABLE_KEY` | Frontend (.env) | Clerk public key |
| `CLERK_SECRET_KEY` | Backend (.env) | Clerk secret key |
| `TIDAL_CLIENT_ID` | Both (.env) | Tidal OAuth client ID |
| `TIDAL_CLIENT_SECRET` | Backend only (.env) | Tidal OAuth client secret (if required) |
| `VITE_TIDAL_REDIRECT_URI` | Frontend (.env) | OAuth callback URL |

---

## Open Questions Resolved

All technical questions have been answered. No outstanding NEEDS CLARIFICATION items.
