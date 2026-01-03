# Implementation Plan: Clerk Authentication with Tidal Account Connection

**Branch**: `016-clerk-tidal-auth` | **Date**: 2026-01-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-clerk-tidal-auth/spec.md`

## Summary

Implement user authentication via Clerk with Google OAuth, plus Tidal account connection using the Tidal SDK authorization code flow. The landing page is public; approved users (from a hardcoded allowlist) can connect their Tidal account, while non-approved users see a waitlist page. Tidal tokens are stored in Clerk's private metadata.

## Technical Context

**Language/Version**: TypeScript 5.3.3 / Node.js 20.x (backend), TypeScript 5.3.3 / React 18.2.0 (frontend)
**Primary Dependencies**:
- Backend: `@clerk/express`, `@clerk/backend`, existing Express/Apollo Server
- Frontend: `@clerk/clerk-react`, `@tidal-music/auth`, existing React/Vite stack
**Storage**: Clerk private metadata (Tidal tokens), existing PostgreSQL (no schema changes needed for auth)
**Testing**: Vitest (existing), React Testing Library (existing)
**Target Platform**: Web application (browser-based)
**Project Type**: Web (frontend + backend)
**Performance Goals**: SC-001 (60s flow completion), SC-003 (3s return user access)
**Constraints**: HTTPS required for Tidal OAuth, max 8KB Clerk private metadata
**Scale/Scope**: Single approved user initially (anton.tcholakov@gmail.com), designed for future allowlist expansion

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First Development | ✅ PASS | Contract tests for auth endpoints, integration tests for OAuth flows |
| II. Code Quality Standards | ✅ PASS | Minimal complexity - standard OAuth patterns, no custom abstractions |
| III. User Experience Consistency | ✅ PASS | Clear user flows defined in spec with acceptance scenarios |
| IV. Robust Architecture | ✅ PASS | Error handling for OAuth failures, token refresh edge cases documented |
| V. Security by Design | ✅ PASS | Clerk handles auth, tokens in private metadata, allowlist enforcement |

**Gate Result**: PASS - Proceed to Phase 0

## Project Structure

### Documentation (this feature)

```text
specs/016-clerk-tidal-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── config/
│   │   └── allowlist.ts           # Hardcoded approved emails
│   ├── middleware/
│   │   └── clerkAuth.ts           # Clerk middleware + auth helpers
│   ├── routes/
│   │   └── auth.ts                # Tidal OAuth callback routes
│   ├── services/
│   │   └── tidalAuthService.ts    # Tidal token management
│   └── server.ts                  # Add Clerk middleware
└── tests/
    ├── contract/
    │   └── auth/                  # Auth endpoint contracts
    └── integration/
        └── auth/                  # OAuth flow integration tests

frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx      # Route guard component
│   │   │   └── TidalConnectButton.tsx  # Tidal OAuth trigger
│   │   └── layout/
│   │       └── AuthLayout.tsx          # Layout for auth pages
│   ├── pages/
│   │   ├── LandingPage.tsx             # Public landing page
│   │   ├── TidalConnectPage.tsx        # Tidal connection prompt
│   │   ├── WaitlistPage.tsx            # Non-approved user page
│   │   └── CallbackPage.tsx            # OAuth callback handler
│   ├── hooks/
│   │   └── useTidalAuth.ts             # Tidal auth state hook
│   └── App.tsx                         # Add ClerkProvider + routes
└── tests/
    └── components/
        └── auth/                       # Component tests
```

**Structure Decision**: Extends existing web application structure. Auth components added to frontend, auth services added to backend. No new top-level directories required.

## Complexity Tracking

> No Constitution Check violations requiring justification.

| Decision | Rationale | Alternative Considered |
|----------|-----------|------------------------|
| Tidal SDK in frontend | SDK designed for browser (handles PKCE, redirects) | Backend-only OAuth rejected - SDK requires browser context |
| Tokens in Clerk metadata | Centralizes auth concerns, encrypted at rest | PostgreSQL rejected - adds schema, duplicates auth storage |
| Hardcoded allowlist file | Simplest for single-user beta | Env var rejected - harder to extend to multiple emails |

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design completion.*

| Principle | Status | Design Evidence |
|-----------|--------|-----------------|
| I. Test-First Development | ✅ PASS | Contract schemas in `contracts/schemas.ts`, test directories defined in project structure |
| II. Code Quality Standards | ✅ PASS | Zod validation for all inputs, clear separation of concerns, no unnecessary abstractions |
| III. User Experience Consistency | ✅ PASS | Four distinct user states with clear transitions in data-model.md |
| IV. Robust Architecture | ✅ PASS | Error handling defined in OpenAPI spec, token refresh flow documented |
| V. Security by Design | ✅ PASS | Tokens in private metadata (backend-only), allowlist enforcement, Clerk handles sessions |

**Post-Design Gate Result**: PASS - Ready for task generation (`/speckit.tasks`)
