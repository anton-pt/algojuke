# Docker Builds and Cloud Run v2 Deployment

**GitHub Issue**: [#39](https://github.com/anton-pt/algojuke/issues/39)

## Summary

Add Docker image builds for `backend/` and `services/worker/` with deployment configuration for GCP Cloud Run v2. Each service has independent Dockerfiles and build configurations. Builds are triggered automatically on push to main and images are stored in GCP Artifact Registry.

## User Stories

### P1 - Core Build Infrastructure

#### US-001: Backend Docker Build

As a developer, I want the backend service to have a production-ready Docker image so that it can be deployed to Cloud Run.

**Acceptance Scenarios:**

```gherkin
Given the backend source code
When I run `docker build` in the backend directory
Then a container image is produced
And the image runs the GraphQL API on port 4000
And the image size is optimized (multi-stage build)

Given the backend container is running
When I send a GraphQL query to /graphql
Then I receive a valid response
```

#### US-002: Worker Docker Build

As a developer, I want the worker service to have a production-ready Docker image so that it can be deployed to Cloud Run.

**Acceptance Scenarios:**

```gherkin
Given the worker service source code
When I run `docker build` in services/worker
Then a container image is produced
And the image runs the Inngest worker on port 3001
And the image size is optimized (multi-stage build)

Given the worker container is running
When Inngest sends a task event
Then the worker processes the event
```

### P1 - CI/CD Pipeline

#### US-003: Automated Image Builds

As a developer, I want Docker images to be built automatically when code is pushed to main so that deployment artifacts are always current.

**Acceptance Scenarios:**

```gherkin
Given a commit is pushed to main branch
When the GitHub Actions workflow runs
Then Docker images for backend and worker are built
And images are tagged with commit SHA and "latest"
And images are pushed to GCP Artifact Registry

Given a build fails
When I check the GitHub Actions logs
Then I can see the build error details
```

### P1 - Cloud Run Configuration

#### US-004: Backend Cloud Run Service

As an operator, I want the backend to be deployable to Cloud Run v2 so that it scales automatically and has managed infrastructure.

**Acceptance Scenarios:**

```gherkin
Given a backend image in Artifact Registry
When I deploy to Cloud Run using the service config
Then the service starts successfully
And the service has appropriate CPU/memory limits
And the service scales based on request concurrency
And health checks verify the service is ready
```

#### US-005: Worker Cloud Run Service

As an operator, I want the worker to be deployable to Cloud Run v2 so that background tasks are processed with managed scaling.

**Acceptance Scenarios:**

```gherkin
Given a worker image in Artifact Registry
When I deploy to Cloud Run using the service config
Then the service starts successfully
And the service connects to Inngest Cloud
And the service has appropriate CPU/memory limits
And the service scales based on concurrent tasks
```

### P2 - Deployment Automation

#### US-006: Continuous Deployment

As a developer, I want services to be automatically deployed to Cloud Run after successful image builds so that main branch always reflects production.

**Acceptance Scenarios:**

```gherkin
Given a successful image build on main branch
When the deployment workflow runs
Then the new image is deployed to Cloud Run
And the deployment uses rolling updates (no downtime)
And deployment status is reported in GitHub Actions
```

## Functional Requirements

### FR-001: Backend Dockerfile

- Multi-stage build (builder + runtime stages)
- Node.js 20 Alpine base image
- Production dependencies only in final image
- Non-root user for security
- Health check endpoint configured
- Environment variable support for all config

### FR-002: Worker Dockerfile

- Multi-stage build (builder + runtime stages)
- Node.js 20 Alpine base image
- Production dependencies only in final image
- Non-root user for security
- Inngest-compatible health endpoint
- Environment variable support for all config

### FR-003: Build Workflow

- Trigger on push to main branch
- Build both services in parallel
- Tag images with: `{region}-docker.pkg.dev/{project}/{repo}/{service}:{sha}` and `latest`
- Use GitHub OIDC for GCP authentication (no long-lived keys)
- Cache Docker layers for faster builds

### FR-004: Artifact Registry Configuration

- Repository for backend images
- Repository for worker images
- Appropriate IAM permissions for Cloud Run to pull images

### FR-005: Backend Cloud Run Service Config

- Service name: `algojuke-backend`
- Port: 4000
- Min instances: 0 (scale to zero)
- Max instances: 10
- CPU: 1
- Memory: 512Mi
- Concurrency: 80
- Startup probe: HTTP GET /health
- Environment variables from Secret Manager

### FR-006: Worker Cloud Run Service Config

- Service name: `algojuke-worker`
- Port: 3001
- Min instances: 1 (always-on for Inngest)
- Max instances: 5
- CPU: 1
- Memory: 1Gi (LLM processing needs more memory)
- Concurrency: 10 (limit concurrent task processing)
- Startup probe: HTTP GET /health
- Environment variables from Secret Manager

### FR-007: Deployment Workflow

- Deploy after successful build
- Use `gcloud run deploy` or Cloud Deploy
- Rolling deployment strategy
- Automatic rollback on failed health checks

## Dependencies

- Existing backend service (GraphQL API)
- Existing worker service (Inngest functions)
- GCP project with billing enabled
- GitHub repository secrets for GCP authentication

## Scope

### In Scope

- Dockerfiles for backend and worker services
- GitHub Actions workflow for building images
- GitHub Actions workflow for deploying to Cloud Run
- Cloud Run service configuration (YAML)
- Artifact Registry repository setup
- Secret Manager integration for environment variables
- Health check endpoints (if not already present)

### Out of Scope

- GCP project creation and initial setup
- Domain/DNS configuration
- SSL certificate management (handled by Cloud Run)
- Monitoring and alerting setup (separate feature)
- Database deployment (assumed existing)
- Inngest Cloud configuration (assumed existing)

## Clarifications

| Question                             | Answer                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| Shared or independent build configs? | Independent - each service has its own Dockerfile and configuration |
| Build triggers?                      | CI on push to main branch (automatic)                               |
| Image registry?                      | GCP Artifact Registry (recommended for Cloud Run)                   |
| Include Cloud Run config?            | Yes - include service.yaml and deployment workflow                  |
