# Research: Serve Frontend SPA from Backend

## Executive Summary

This feature bundles the frontend React SPA into the backend Docker image and serves it as static content from Express. The implementation requires:

1. Adding frontend build stages to the backend Dockerfile
2. Adding Express static middleware with SPA fallback routing
3. Ensuring API routes take precedence over static file serving

The approach uses Express's built-in `express.static()` middleware with a custom SPA fallback handler placed **after** all API routes.

## Key Decisions

### D1: Dockerfile Multi-Stage Build Strategy

**Decision**: Add two new stages to the backend Dockerfile - `frontend-deps` and `frontend-builder` - then copy the built assets to the runner stage.

**Rationale**:

- Keeps frontend and backend builds isolated
- Leverages Docker layer caching for both npm installs
- Single image output simplifies deployment
- No changes needed to CI/CD pipeline

**Alternatives Considered**:

- Separate CI step to build frontend: Rejected because it complicates the workflow and requires artifact passing
- Monorepo build tool (nx/turborepo): Over-engineered for this use case

### D2: Static File Location

**Decision**: Copy frontend build to `/app/public` in the runner stage and serve from there.

**Rationale**:

- Clear separation from backend code (`/app/dist` for backend, `/app/public` for frontend)
- Standard convention for static assets
- Easy to configure in Express

**Alternatives Considered**:

- Serve from `/app/dist/public`: Rejected because it mixes frontend/backend concerns
- Serve from root `/public`: Rejected because non-root user can't access outside `/app`

### D3: SPA Fallback Routing Implementation

**Decision**: Add static middleware and SPA fallback **after** all API routes in server.ts.

**Rationale**:

- Express processes middleware in order - API routes defined first will match first
- Only unmatched GET requests fall through to static serving
- Simple implementation using `express.static()` + custom fallback handler

**Pattern**:

```typescript
// After all API routes...
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(__dirname, "../public");

  // Serve static files
  app.use(
    express.static(publicPath, {
      maxAge: "1y", // Cache hashed assets
      index: false, // Don't auto-serve index.html
    }),
  );

  // SPA fallback - serve index.html for unmatched GET requests
  app.get("*", (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
}
```

### D4: Cache Headers Strategy

**Decision**: Use `maxAge: '1y'` for static assets (Vite adds content hashes) and no-cache for index.html.

**Rationale**:

- Vite adds content hashes to all assets (e.g., `main.abc123.js`)
- Hashed assets can be cached indefinitely - new builds get new hashes
- index.html must not be cached to ensure users get the latest asset references

**Implementation**:

- `express.static()` with `maxAge: '1y'` handles hashed assets
- `res.sendFile()` for index.html doesn't set cache headers (browser default)
- Can add explicit `Cache-Control: no-cache` header for index.html if needed

### D5: Production-Only Static Serving

**Decision**: Wrap static serving middleware in `NODE_ENV === 'production'` check.

**Rationale**:

- In development, Vite dev server handles frontend with HMR
- Backend doesn't need frontend files during development
- Keeps development workflow unchanged

## Implementation Patterns

### Dockerfile Changes

```dockerfile
# Stage 1: Backend Dependencies (existing)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Frontend Dependencies (NEW)
FROM node:20-alpine AS frontend-deps
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

# Stage 3: Frontend Builder (NEW)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

# Stage 4: Backend Builder (existing, renamed)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./
RUN npm run build
RUN cp -r src/schema dist/schema

# Stage 5: Runner (modified)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy backend
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy frontend build (NEW)
COPY --from=frontend-builder /app/dist ./public

USER nodeuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]
```

### Server.ts Changes

```typescript
import path from "path";

// ... existing code ...

// After GraphQL endpoint, before httpServer.listen():

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(__dirname, "../public");

  // Serve static assets with long cache (Vite adds hashes)
  app.use(
    express.static(publicPath, {
      maxAge: "1y",
      index: false, // Don't auto-serve index.html for directory requests
    }),
  );

  // SPA fallback - all unmatched GET requests serve index.html
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(publicPath, "index.html"));
  });

  console.log("📁 Serving frontend from /public");
}

// Start listening
await new Promise<void>((resolve) => httpServer.listen({ port }, resolve));
```

## Files to Modify

| File                    | Changes                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `backend/Dockerfile`    | Add frontend-deps, frontend-builder stages; copy frontend build to /public |
| `backend/src/server.ts` | Add static middleware and SPA fallback after API routes                    |

## Build Context Consideration

**Important**: The Dockerfile build context must include both `backend/` and `frontend/` directories. This requires updating the Docker build context in the GitHub Actions workflow.

Current workflow builds from `backend/` context:

```yaml
context: backend
```

Updated workflow must build from root with Dockerfile path:

```yaml
context: .
file: backend/Dockerfile
```

This allows `COPY frontend/ ./` to work in the Dockerfile.

## Files to Modify (Updated)

| File                           | Changes                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `backend/Dockerfile`           | Add frontend build stages; copy frontend build to /public                        |
| `backend/src/server.ts`        | Add static middleware and SPA fallback after API routes                          |
| `.github/workflows/deploy.yml` | Update backend build context from `backend` to `.` with explicit Dockerfile path |
