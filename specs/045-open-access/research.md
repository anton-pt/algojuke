# Technical Research: Open Access to All Google + Tidal Users

**Feature Branch**: `045-open-access`
**Created**: 2026-01-08
**GitHub Issue**: [#45](https://github.com/anton-pt/algojuke/issues/45)

## Executive Summary

This feature removes the email allowlist restriction from AlgoJuke, opening access to any user with a Google account and Tidal connection. The implementation involves removing 2 files entirely, modifying 11 files (backend routes, middleware, schemas, frontend components, tests), and updating documentation. The changes are straightforward deletions and simplifications with no new functionality added.

## Key Decisions

### Decision 1: Complete Removal vs Feature Flag

**Decision**: Remove all allowlist code completely rather than feature-flagging it.

**Rationale**: Per clarification session, the user explicitly requested complete removal. Feature flags add maintenance burden and dead code paths. If access restrictions are needed in the future, they can be re-implemented with a fresh design.

**Alternatives Rejected**:

- Feature flag with `ENABLE_ALLOWLIST` env var - Rejected: adds complexity, dead code paths
- Comment out code - Rejected: clutters codebase, harder to maintain

### Decision 2: Remove `isApproved` from API Response Schema

**Decision**: Remove the `isApproved` field from the `GET /api/auth/status` response entirely.

**Rationale**: The field becomes meaningless when all users are implicitly approved. Keeping it would require always returning `true`, which adds no value and confuses the API contract.

**Alternatives Rejected**:

- Return `isApproved: true` always - Rejected: semantic noise, misleading about system behavior
- Rename to `canAccess` - Rejected: adds no value since it would always be `true`

### Decision 3: Simplify ProtectedRoute Flow

**Decision**: Remove the waitlist redirect check entirely from `ProtectedRoute.tsx`. The new flow becomes:

1. Not signed in → Landing page
2. Signed in, no Tidal connection (when `requireTidal=true`) → Connect page
3. Signed in with Tidal → Render children

**Rationale**: With no waitlist page, the approval check serves no purpose. The component should only enforce authentication and Tidal connection requirements.

### Decision 4: Keep `requireAuth` Middleware, Remove `requireApproved`

**Decision**: Routes currently protected by both `requireAuth` and `requireApproved` will only use `requireAuth`.

**Rationale**: Authentication remains required; authorization (approval) is removed. The middleware separation was good design for Feature 016 but `requireApproved` is now obsolete.

## Implementation Patterns

### Pattern 1: Removing Middleware from Routes

**Before** (backend/src/routes/auth.ts):

```typescript
router.post(
  "/tidal/tokens",
  requireAuth,
  requireApproved,  // ← Remove this line
  async (req, res) => { ... }
);
```

**After**:

```typescript
router.post(
  "/tidal/tokens",
  requireAuth,
  async (req, res) => { ... }
);
```

### Pattern 2: Simplifying Auth Status Response

**Before** (backend/src/routes/auth.ts):

```typescript
const approved = email ? isApprovedUser(email) : false;
return res.json({
  isAuthenticated: true,
  isApproved: approved, // ← Remove
  hasTidalConnection: !!tidalConnection,
  // ...
});
```

**After**:

```typescript
return res.json({
  isAuthenticated: true,
  hasTidalConnection: !!tidalConnection,
  // ...
});
```

### Pattern 3: Simplifying ProtectedRoute

**Before** (frontend/src/components/auth/ProtectedRoute.tsx):

```typescript
if (!authStatus.isApproved) {
  return <Navigate to="/waitlist" replace />;
}
```

**After**: Remove this entire block. The component proceeds directly to Tidal connection check.

### Pattern 4: Removing Route Definitions

**Before** (frontend/src/App.tsx):

```typescript
import { WaitlistPage } from "./pages/WaitlistPage";
// ...
<Route path="/waitlist" element={<WaitlistPage />} />
```

**After**: Remove both the import and the Route element.

## Files to Modify

### Files to Remove Entirely (2 files)

| File                                  | Reason                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| `backend/src/config/allowlist.ts`     | Contains `APPROVED_EMAILS` and `isApprovedUser()` function |
| `frontend/src/pages/WaitlistPage.tsx` | Waitlist page component shown to non-approved users        |

### Backend Files to Modify (5 files)

| File                                  | Changes                                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `backend/src/middleware/clerkAuth.ts` | Remove `requireApproved` middleware function and `isApprovedUser` import                                       |
| `backend/src/routes/auth.ts`          | Remove `isApprovedUser` import, remove `requireApproved` from routes, remove `isApproved` from status response |
| `backend/src/routes/playlists.ts`     | Remove `requireApproved` from `/api/playlists/export` route                                                    |
| `backend/src/schemas/auth.ts`         | Remove `isApproved` field from `AuthStatusSchema`                                                              |
| `backend/README.md`                   | Remove allowlist documentation sections                                                                        |

### Frontend Files to Modify (3 files)

| File                                              | Changes                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `frontend/src/App.tsx`                            | Remove `WaitlistPage` import and `/waitlist` route                 |
| `frontend/src/components/auth/ProtectedRoute.tsx` | Remove `isApproved` from interface, remove waitlist redirect logic |
| `frontend/README.md`                              | Remove waitlist route documentation                                |

### Test Files to Modify/Remove (6 files)

| File                                                          | Changes                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `backend/tests/contract/auth/authStatus.test.ts`              | Remove `isApproved` assertions                             |
| `backend/tests/contract/auth/tidalTokensUnauthorized.test.ts` | Remove or repurpose (test unauthenticated, not unapproved) |
| `backend/tests/integration/auth/approvedUserFlow.test.ts`     | Rename/simplify to test any user flow                      |
| `backend/tests/integration/auth/incompleteTidalFlow.test.ts`  | Remove approval status assertions                          |
| `frontend/tests/components/auth/ProtectedRoute.test.tsx`      | Remove waitlist redirect test cases                        |
| `frontend/tests/components/auth/WaitlistPage.test.tsx`        | Remove entire file                                         |

## Routes to Update

| Route                          | Current Protection               | New Protection |
| ------------------------------ | -------------------------------- | -------------- |
| `POST /api/auth/tidal/tokens`  | `requireAuth`, `requireApproved` | `requireAuth`  |
| `POST /api/auth/tidal/refresh` | `requireAuth`, `requireApproved` | `requireAuth`  |
| `POST /api/playlists/export`   | `requireAuth`, `requireApproved` | `requireAuth`  |

## API Schema Changes

### GET /api/auth/status Response

**Before**:

```json
{
  "isAuthenticated": boolean,
  "isApproved": boolean,
  "hasTidalConnection": boolean,
  "tidalTokenExpired": boolean,
  "email": string,
  "userId": string
}
```

**After**:

```json
{
  "isAuthenticated": boolean,
  "hasTidalConnection": boolean,
  "tidalTokenExpired": boolean,
  "email": string,
  "userId": string
}
```

## Verification Checklist

After implementation, verify:

1. `grep -r "allowlist" --include="*.ts" --include="*.tsx"` returns no results (excluding spec files)
2. `grep -r "isApproved" --include="*.ts" --include="*.tsx"` returns no results (excluding spec files)
3. `grep -r "waitlist" --include="*.ts" --include="*.tsx"` returns no results (excluding spec files)
4. `grep -r "requireApproved" --include="*.ts" --include="*.tsx"` returns no results
5. Navigating to `/waitlist` returns 404 or redirects to landing
6. Any Google account can sign in and connect Tidal
7. All existing tests pass (after test file updates)

## Implementation Order

1. **Backend first**: Remove allowlist config and middleware
2. **Update routes**: Remove `requireApproved` from route definitions
3. **Update schemas**: Remove `isApproved` from auth status schema
4. **Frontend**: Remove waitlist page and route, simplify ProtectedRoute
5. **Tests**: Update/remove test files
6. **Documentation**: Update READMEs
7. **Verification**: Run grep checks and manual testing
