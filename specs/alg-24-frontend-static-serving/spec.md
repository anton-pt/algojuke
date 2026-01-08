# Serve Frontend SPA from Backend in Production

**GitHub Issue**: [#41](https://github.com/anton-pt/algojuke/issues/41)

## Summary

Bundle and serve the frontend React SPA as static content from the backend Express server in production. The frontend will be built in the same Docker multi-stage build and served at the root path, with SPA fallback routing for client-side navigation.

## User Stories

### US-001: Access Frontend Application (P1)

As a user, I want to access the frontend application from the same domain as the API so that I don't need to configure CORS or manage multiple deployments.

**Acceptance Scenarios:**

```gherkin
Given the backend is deployed to Cloud Run
When I navigate to the root URL (/)
Then I see the frontend React application

Given I am on the frontend application
When I navigate to /graphql
Then I receive the GraphQL API response (not the frontend)

Given I am on the frontend application
When I navigate to /api/chat
Then I receive the API response (not the frontend)
```

### US-002: Client-Side Routing Support (P1)

As a user, I want deep links to work correctly so that I can bookmark and share specific pages.

**Acceptance Scenarios:**

```gherkin
Given I have a direct link to /chat/abc-123
When I navigate to that URL directly
Then I see the frontend application with the correct route rendered

Given the frontend makes API calls
When the frontend calls /graphql or /api/*
Then the requests are handled by the backend API, not served as static files
```

### US-003: Static Asset Caching (P2)

As a user, I want static assets to be cached efficiently so that the application loads quickly on repeat visits.

**Acceptance Scenarios:**

```gherkin
Given I request a hashed asset (e.g., main.abc123.js)
When the response is returned
Then it includes appropriate cache headers for long-term caching

Given I request index.html
When the response is returned
Then it includes no-cache headers to ensure fresh content
```

## Functional Requirements

### FR-001: Docker Multi-Stage Build

The backend Dockerfile must include a stage that builds the frontend:

1. Add a `frontend-builder` stage using node:20-alpine
2. Copy frontend source and install dependencies
3. Run `npm run build` to produce the `dist/` directory
4. Copy the built assets to the final runner stage

### FR-002: Express Static File Serving

The backend Express server must serve static files:

1. Serve files from a `/public` directory containing the frontend build
2. API routes (`/graphql`, `/api/*`, `/health`) take precedence over static files
3. Unmatched GET requests fall back to `index.html` for SPA routing
4. Set appropriate cache headers for static assets

### FR-003: Route Priority

Request handling priority (highest to lowest):

1. `/health` - Health check endpoint
2. `/graphql` - GraphQL API
3. `/api/*` - REST API routes
4. Static files from `/public` (exact match)
5. Fallback to `/public/index.html` for SPA routing

### FR-004: Production-Only Static Serving

Static file serving should only be enabled in production:

1. Check `NODE_ENV === 'production'` before mounting static middleware
2. In development, frontend runs separately via Vite dev server
3. Log a message indicating whether static serving is enabled

## Scope

### In Scope

- Modifying backend Dockerfile to include frontend build
- Adding Express static file middleware to server.ts
- SPA fallback routing for client-side routes
- Basic cache headers for static assets

### Out of Scope

- CDN configuration (future optimization)
- Gzip/Brotli compression (can be added later)
- Service worker / PWA features
- Frontend code changes (just serving existing build)

## Dependencies

- Backend service (already deployed to Cloud Run)
- Frontend build process (existing Vite configuration)

## Clarifications

**Q: Should the backend serve the frontend at root (/) or a specific path?**
A: Root path (/). API remains at /graphql and /api/\*.

**Q: How should client-side routing be handled for deep links?**
A: Fallback to index.html - all unmatched routes serve index.html for React Router to handle.

**Q: Should the frontend build happen in the same Dockerfile or separately?**
A: Same Dockerfile using multi-stage build for simpler CI/CD.
