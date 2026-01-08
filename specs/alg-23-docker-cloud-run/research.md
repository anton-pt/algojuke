# Technical Decisions: Docker Builds and Cloud Run v2 Deployment

## Executive Summary

This document outlines technical decisions for containerizing `backend/` and `services/worker/` for GCP Cloud Run v2 deployment. Key findings:

1. **Existing worker Dockerfile** is a development-only configuration (uses `npm run dev`); needs production-ready replacement
2. **Backend requires new Dockerfile** with proper handling of GraphQL schema files
3. **No existing GitHub Actions** - workflows will be created from scratch
4. **Both services use ESM** with TypeScript compilation to `dist/`

## Key Decisions

### D1: Multi-stage Docker Builds

**Decision**: Use 3-stage builds: deps → builder → runner

**Rationale**:

- Stage 1 (deps): Install all dependencies for building
- Stage 2 (builder): Compile TypeScript, produce production artifacts
- Stage 3 (runner): Minimal Alpine image with only runtime dependencies

**Alternatives Considered**:

- Single-stage build: Rejected due to larger image size (~1GB vs ~200MB)
- Two-stage build: Rejected because separating deps installation enables better layer caching

### D2: Node.js 20 Alpine Base Image

**Decision**: Use `node:20-alpine` for all stages

**Rationale**:

- Matches `engines.node: ">=20.0.0"` in both package.json files
- Alpine provides smallest image footprint (~120MB base)
- Compatible with all current dependencies

**Alternatives Considered**:

- `node:20-slim`: Larger but more compatible - not needed for these services
- `node:20`: Full Debian - unnecessary for production

### D3: Non-root User for Runtime

**Decision**: Create dedicated `node` user with UID 1001 for running application

**Rationale**:

- Cloud Run best practice for security
- Prevents container escape vulnerabilities
- Aligns with principle of least privilege

### D4: Backend Schema File Handling

**Decision**: Copy GraphQL schema files to `dist/schema/` during build

**Rationale**:

- Backend `server.ts` loads `.graphql` files via `readFileSync` at runtime (lines 48-76)
- TypeScript compilation only outputs `.js` files to `dist/`
- Schema files must be explicitly copied

**Implementation**:

```dockerfile
# In builder stage, after tsc
RUN cp -r src/schema dist/schema
```

### D5: GitHub OIDC for GCP Authentication

**Decision**: Use Workload Identity Federation, not service account keys

**Rationale**:

- No long-lived credentials to manage or rotate
- Recommended by Google Cloud for GitHub Actions
- Keys automatically expire after workflow run

**Setup Required**:

1. Create Workload Identity Pool in GCP
2. Create Provider linked to GitHub repo
3. Grant Artifact Registry and Cloud Run roles to pool

### D6: Single Workflow File for Build and Deploy

**Decision**: One workflow (`.github/workflows/deploy.yml`) handles both services

**Rationale**:

- Services share GCP project and region configuration
- Matrix strategy enables parallel builds
- Single source of truth for deployment logic

**Alternatives Considered**:

- Separate workflows per service: Rejected due to configuration duplication
- Monorepo tooling (nx, turborepo): Over-engineered for two services

### D7: Cloud Run Service YAML Configuration

**Decision**: Store service configs in `deploy/cloudrun/{service}.yaml`

**Rationale**:

- Declarative configuration versioned in Git
- Enables `gcloud run services replace` for atomic updates
- Clear separation from Dockerfiles

### D8: Separate Artifact Registry Repositories

**Decision**: One repository per service: `algojuke-backend`, `algojuke-worker`

**Rationale**:

- Clear image ownership and lifecycle
- Simpler IAM permissions per service
- Independent cleanup policies

### D9: Worker Min Instances = 1

**Decision**: Worker service maintains 1 minimum instance (no scale-to-zero)

**Rationale**:

- Inngest requires persistent connection to receive events
- Cold start would cause missed/delayed events
- Cost is minimal (~$10/month for always-on instance)

**Backend** uses min instances = 0 since it handles HTTP requests which can tolerate cold starts.

### D10: Environment Variables via Secret Manager

**Decision**: Reference secrets using `valueFrom.secretKeyRef` in Cloud Run YAML

**Rationale**:

- Secrets not stored in Git or workflow files
- Automatic versioning and audit logging
- Native Cloud Run integration

**Secrets to Create**:
| Secret Name | Service | Description |
|-------------|---------|-------------|
| `database-url` | backend | PostgreSQL connection string |
| `tidal-client-id` | backend | Tidal API credentials |
| `tidal-client-secret` | backend | Tidal API credentials |
| `clerk-secret-key` | backend | Clerk authentication |
| `anthropic-api-key` | backend, worker | LLM API key |
| `musixmatch-api-key` | worker | Lyrics API |
| `reccobeats-api-key` | worker | Audio features API |
| `langfuse-secret-key` | backend, worker | Observability |
| `inngest-signing-key` | worker | Inngest Cloud auth |

## Implementation Patterns

### Backend Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Copy GraphQL schemas to dist (not compiled by tsc)
RUN cp -r src/schema dist/schema

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodeuser
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/graphql?query=%7B__typename%7D || exit 1

CMD ["node", "dist/server.js"]
```

### Worker Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodeuser
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]
```

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main]

env:
  GCP_PROJECT_ID: ${{ vars.GCP_PROJECT_ID }}
  GCP_REGION: ${{ vars.GCP_REGION }}
  GAR_LOCATION: ${{ vars.GCP_REGION }}-docker.pkg.dev

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # Required for OIDC

    strategy:
      matrix:
        service:
          - name: backend
            path: backend
            image: algojuke-backend
          - name: worker
            path: services/worker
            image: algojuke-worker

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.GAR_LOCATION }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: ${{ matrix.service.path }}
          push: true
          tags: |
            ${{ env.GAR_LOCATION }}/${{ env.GCP_PROJECT_ID }}/${{ matrix.service.image }}/${{ matrix.service.name }}:${{ github.sha }}
            ${{ env.GAR_LOCATION }}/${{ env.GCP_PROJECT_ID }}/${{ matrix.service.image }}/${{ matrix.service.name }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    strategy:
      matrix:
        service: [backend, worker]

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ vars.WIF_PROVIDER }}
          service_account: ${{ vars.WIF_SERVICE_ACCOUNT }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: algojuke-${{ matrix.service }}
          region: ${{ env.GCP_REGION }}
          image: ${{ env.GAR_LOCATION }}/${{ env.GCP_PROJECT_ID }}/algojuke-${{ matrix.service }}/${{ matrix.service }}:${{ github.sha }}
          metadata: deploy/cloudrun/${{ matrix.service }}.yaml
```

### Cloud Run Service Config (Backend)

```yaml
# deploy/cloudrun/backend.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: algojuke-backend
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"
        autoscaling.knative.dev/maxScale: "10"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
        - image: IMAGE_PLACEHOLDER
          ports:
            - containerPort: 4000
          resources:
            limits:
              cpu: "1"
              memory: 512Mi
          startupProbe:
            httpGet:
              path: /graphql?query=%7B__typename%7D
              port: 4000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "4000"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-url
                  key: latest
            # ... additional secrets
```

## Files to Create/Modify

### New Files

| Path                           | Purpose                         |
| ------------------------------ | ------------------------------- |
| `backend/Dockerfile`           | Production Docker build         |
| `services/worker/Dockerfile`   | Replace existing dev Dockerfile |
| `.github/workflows/deploy.yml` | CI/CD pipeline                  |
| `deploy/cloudrun/backend.yaml` | Backend service config          |
| `deploy/cloudrun/worker.yaml`  | Worker service config           |

### Files to Modify

| Path                            | Change                                |
| ------------------------------- | ------------------------------------- |
| `backend/.dockerignore`         | Create to exclude node_modules, tests |
| `services/worker/.dockerignore` | Create to exclude node_modules, tests |

## GCP Setup Requirements (Out of Scope for Implementation)

These must be configured manually before deployment works:

1. **Artifact Registry**

   ```bash
   gcloud artifacts repositories create algojuke-backend --repository-format=docker --location=REGION
   gcloud artifacts repositories create algojuke-worker --repository-format=docker --location=REGION
   ```

2. **Workload Identity Federation**

   ```bash
   gcloud iam workload-identity-pools create github-pool --location=global
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --workload-identity-pool=github-pool \
     --issuer-uri=https://token.actions.githubusercontent.com \
     --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository
   ```

3. **Secret Manager Secrets**
   - Create each secret listed in D10
   - Grant Cloud Run service account access to read secrets

4. **GitHub Repository Variables**
   - `GCP_PROJECT_ID`
   - `GCP_REGION` (e.g., `us-central1`)
   - `WIF_PROVIDER` (workload identity provider resource name)
   - `WIF_SERVICE_ACCOUNT` (service account email)
