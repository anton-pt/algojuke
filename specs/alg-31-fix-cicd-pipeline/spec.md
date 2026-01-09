# Feature Specification: Fix CI/CD pipeline after monorepo implementation and update README.md

**Feature Branch**: `alg-31-fix-cicd-pipeline`
**Created**: 2026-01-09
**Status**: Draft
**Linear Issue**: [ALG-31](https://linear.app/algojuke/issue/ALG-31)
**Input**: After the implementation of ALG-28 (monorepo with npm workspaces), the CI/CD pipeline fails to build Docker images. The root `package-lock.json` isn't copied during Docker builds, and stray `package-lock.json` files in service directories need removal. Also update README.md with monorepo commands.

## Clarifications

### Session 2026-01-09

- Q: Which approach for Docker deps with npm workspaces? → A: Copy root package-lock.json, use npm ci with workspace flag
- Q: Should README.md be updated? → A: Yes, add monorepo commands and development workflow
- Q: Which services need Docker fixes? → A: Backend and Worker only (the two in CI/CD matrix)

## User Scenarios & Testing

### User Story 1 - CI/CD Pipeline Builds Successfully (Priority: P1)

As a developer, I want the CI/CD pipeline to successfully build Docker images for both backend and worker services so that deployments are not blocked.

**Why this priority**: Core issue - pipeline is completely broken, blocking all deployments.

**Independent Test**: Push to main branch and verify GitHub Actions completes successfully with both images pushed to GAR.

**Acceptance Scenarios**:

1. **Given** the monorepo structure, **When** CI/CD runs the backend Docker build, **Then** the image builds successfully with all dependencies
2. **Given** the monorepo structure, **When** CI/CD runs the worker Docker build, **Then** the image builds successfully with all dependencies
3. **Given** the updated Dockerfiles, **When** `docker build` is run locally, **Then** it completes without errors

---

### User Story 2 - Clean Lock File Structure (Priority: P1)

As a developer, I want only a single `package-lock.json` at the repository root so that dependency resolution is consistent and deterministic.

**Why this priority**: Multiple lock files cause npm workspace conflicts and non-reproducible builds.

**Independent Test**: Run `find . -name "package-lock.json" -not -path "./node_modules/*"` and verify only root lock file exists.

**Acceptance Scenarios**:

1. **Given** the monorepo, **When** I search for package-lock.json files, **Then** only `/package-lock.json` exists (not in backend/, frontend/, services/\*/)
2. **Given** the clean lock file structure, **When** I run `npm install` from root, **Then** all workspace dependencies are installed correctly

---

### User Story 3 - README Reflects Monorepo (Priority: P2)

As a new developer, I want the README to show monorepo-style commands so that I can quickly set up and develop the project.

**Why this priority**: Improves DX but not blocking.

**Independent Test**: Follow README instructions from scratch and verify all commands work.

**Acceptance Scenarios**:

1. **Given** the README, **When** I follow "Getting Started", **Then** I can install all dependencies with a single `npm install` from root
2. **Given** the README, **When** I look for test commands, **Then** I see `npm run test` from root instead of per-package commands

---

### Edge Cases

- What if a service has dependencies not in root package.json? The workspace package.json still lists them, and `npm ci --workspace=X` installs them from root lock file.
- What if Docker build context needs files from multiple directories? Backend already uses root context (`.`) so it can access both backend/ and frontend/.
- What if npm ci fails with workspace flag? Fall back to full install then prune (acceptable trade-off per user decision).

## Requirements

### Functional Requirements

- **FR-001**: Backend Dockerfile MUST copy root `package.json` and `package-lock.json` and use `npm ci --workspace=backend --workspace=frontend` for dependencies
- **FR-002**: Worker Dockerfile MUST have build context changed to root (`.`) and copy root lock file
- **FR-003**: All service-level `package-lock.json` files MUST be deleted (backend, frontend, services/worker, services/search-index, services/observability)
- **FR-004**: README "Getting Started" section MUST use `npm install` from root instead of per-package installs
- **FR-005**: README "Testing" section MUST use `npm run test` from root instead of per-package commands
- **FR-006**: GitHub Actions workflow MUST update worker service build context from `services/worker` to `.`

### Non-Functional Requirements

- **NFR-001**: Docker images SHOULD not significantly increase in size (< 20% growth acceptable)
- **NFR-002**: Build time SHOULD not significantly increase (< 30% growth acceptable)

## Dependencies

- @specs/alg-28-monorepo-structure-with-npm-workspaces (provides the workspace structure this fix builds on)

## Out of Scope

- Adding Docker builds for search-index, observability, or frontend services
- Multi-stage build optimization to reduce image size
- GitHub Actions caching improvements
- Production dependency pruning in Docker images
