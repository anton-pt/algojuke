# CI/CD Pipeline

This document describes the algojuke CI/CD pipeline, optimized for agentic coding workflows.

## Overview

The pipeline is split into two workflows:

| Workflow                    | Trigger                  | Purpose                                    |
| --------------------------- | ------------------------ | ------------------------------------------ |
| **CI** (`ci.yml`)           | Push to any branch, PRs  | Quality checks + Docker build verification |
| **Release** (`release.yml`) | GitHub release published | Build, push, and deploy to GCP             |

## CI Workflow

Runs on every push to any branch and all pull requests, providing fast feedback for agentic coding.

### Jobs

1. **Quality Checks**
   - Type checking (`npm run type-check`)
   - Linting (`npm run lint`)
   - Tests (`npm run test`)

2. **Build Verification** (runs after checks pass)
   - Builds Docker images for backend and worker
   - Uses placeholder values for Vite build args
   - **Does NOT push images** - verification only
   - Uses GitHub Actions cache for fast rebuilds

### Concurrency

Uses `cancel-in-progress: true` to cancel queued runs when new commits are pushed, optimizing for rapid iteration.

## Release Workflow

Deploys to production when a GitHub release is published.

### Jobs

1. **Quality Checks** - Re-runs all checks (defense in depth)

2. **Build & Push**
   - Authenticates to GCP via Workload Identity Federation (OIDC)
   - Builds and pushes to Google Artifact Registry
   - Tags images with:
     - `:sha` - Git commit SHA (immutable reference)
     - `:version` - Release tag (e.g., `v1.2.3`)
     - `:latest` - Latest release

3. **Deploy**
   - Updates Cloud Run service configuration with new image
   - Deploys backend and worker services

### Creating a Release

```bash
# Via GitHub CLI
gh release create v1.2.3 --title "Release v1.2.3" --notes "Release notes here"

# Or use the GitHub web UI: Releases → Draft a new release
```

### Manual/Emergency Deployment

Use workflow dispatch for emergency deployments without creating a release:

```bash
gh workflow run release.yml -f tag=v1.2.3
```

## Configuration

### Required Secrets

| Secret                       | Description                           |
| ---------------------------- | ------------------------------------- |
| `GCP_PROJECT_ID`             | Google Cloud project ID               |
| `GCP_REGION`                 | GCP region (e.g., `europe-west4`)     |
| `WIF_PROVIDER`               | Workload Identity Federation provider |
| `WIF_SERVICE_ACCOUNT`        | GCP service account for deployments   |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend         |
| `VITE_TIDAL_CLIENT_ID`       | Tidal OAuth client ID                 |
| `VITE_TIDAL_REDIRECT_URI`    | Tidal OAuth redirect URI              |

### Environment

The `production` environment should be configured in GitHub repository settings with:

- Required reviewers (optional)
- Deployment branch restrictions (only from releases)

## Architecture

```
Push to branch          Push to main            GitHub Release
     │                       │                       │
     ▼                       ▼                       ▼
┌─────────────────────────────────┐           ┌─────────────┐
│            ci.yml               │           │ release.yml │
├─────────────────────────────────┤           ├─────────────┤
│ 1. Quality Checks               │           │ 1. Checks   │
│    - type-check                 │           │ 2. Build    │
│    - lint                       │           │    & Push   │
│    - test                       │           │ 3. Deploy   │
│ 2. Build Verification           │           │    to GCP   │
│    - docker build (no push)     │           └─────────────┘
└─────────────────────────────────┘
```

## Troubleshooting

### Build failures

1. Check the "Quality Checks" job first - most failures are type/lint/test errors
2. For Docker build failures, check the build logs for missing dependencies

### Deployment failures

1. Verify GCP authentication - check WIF provider configuration
2. Verify secrets are set in the repository settings
3. Check Cloud Run service logs for runtime errors

### Cache issues

If builds seem to use stale cache:

```yaml
# The cache scope is per-service
cache-from: type=gha,scope=${{ matrix.service.name }}
```

Clear via GitHub Actions → Caches → Delete specific cache entries.
