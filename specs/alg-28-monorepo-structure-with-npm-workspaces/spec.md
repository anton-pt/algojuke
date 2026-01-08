# Feature Specification: Monorepo structure with npm workspaces

**Feature Branch**: `alg-28-monorepo-structure-with-npm-workspaces`
**Created**: 2026-01-08
**Status**: Draft
**Linear Issue**: [ALG-28](https://linear.app/algojuke/issue/ALG-28)
**Input**: Implement a monorepo structure so that npm packages at `backend/`, `frontend/`, `services/*` are all referenced by a new `package.json` in the root of the repository. Create common scripts in the root `package.json` which run `lint`, `lint:fix`, `type-check`, and `test` for all the respective repo packages. Document the commands in `CLAUDE.md` and add a hook to run `lint:fix` immediately after writing any files.

## Clarifications

### Session 2026-01-08

- Q: Should root scripts fail fast or run all packages and report all errors? → A: Fail fast - stop immediately when any package fails
- Q: How to handle the 3 services (worker, search-index, observability) that lack ESLint configs? → A: Add ESLint to all services for consistent linting
- Q: Should there be per-package targeting from root? → A: Yes, support `npm run <cmd> --workspace=<name>` pattern

## User Scenarios & Testing

### User Story 1 - Run Commands Across All Packages (Priority: P1)

As a developer, I want to run lint, type-check, and test commands from the repo root so that I can verify the entire codebase with a single command.

**Why this priority**: Core value proposition of a monorepo - unified command execution.

**Independent Test**: Run `npm run lint` from repo root and verify all 5 packages are linted.

**Acceptance Scenarios**:

1. **Given** I am in the repo root, **When** I run `npm run lint`, **Then** all 5 packages are linted and the command fails fast on first error
2. **Given** I am in the repo root, **When** I run `npm run test`, **Then** tests run for all packages sequentially
3. **Given** I am in the repo root, **When** I run `npm run type-check`, **Then** TypeScript checks all packages

---

### User Story 2 - Target Specific Package (Priority: P2)

As a developer working on a specific package, I want to run commands for just that package from the root so that I get faster feedback.

**Why this priority**: Common workflow when iterating on a single package.

**Independent Test**: Run `npm run lint --workspace=backend` and verify only backend is linted.

**Acceptance Scenarios**:

1. **Given** I am in the repo root, **When** I run `npm run lint --workspace=backend`, **Then** only the backend package is linted
2. **Given** I am in the repo root, **When** I run `npm run test --workspace=frontend`, **Then** only frontend tests run

---

### User Story 3 - Auto-Fix on File Write (Priority: P2)

As a developer using Claude Code, I want lint:fix to run automatically after files are written so that code is consistently formatted.

**Why this priority**: Reduces manual formatting steps and maintains code consistency.

**Independent Test**: Write a TypeScript file with Claude Code and verify Prettier and ESLint fixes are applied.

**Acceptance Scenarios**:

1. **Given** I write a TypeScript file with Claude Code, **When** the file is saved, **Then** Prettier formats it and ESLint --fix is applied

---

### Edge Cases

- What happens when a package lacks a script (e.g., no `lint` script)? The `--if-present` flag gracefully skips that package.
- What happens when ESLint finds unfixable errors? The hook uses `|| true` to not block the file write; errors are visible in lint output.
- What happens when running from within a package directory? npm workspace commands work from anywhere in the monorepo.

## Requirements

### Functional Requirements

- **FR-001**: System MUST have a root `package.json` defining npm workspaces for `backend`, `frontend`, `services/worker`, `services/search-index`, `services/observability`
- **FR-002**: Root scripts MUST run commands across all workspaces with fail-fast behavior using `npm run <script> --workspaces`
- **FR-003**: All packages MUST have `lint`, `lint:fix`, `type-check`, and `test` scripts
- **FR-004**: ESLint configs MUST be added to worker and observability services (search-index already has one)
- **FR-005**: PostToolUse hook MUST run both Prettier and ESLint --fix on file writes
- **FR-006**: CLAUDE.md MUST document all new monorepo commands including per-workspace targeting

### Key Entities

- **Workspace**: An npm package referenced in the root `package.json` workspaces array
- **Root Script**: A script in root `package.json` that delegates to workspace scripts
- **PostToolUse Hook**: Claude Code hook that runs after Write/Edit tool calls

## Success Criteria

- **SC-001**: `npm run lint` from root successfully lints all 5 packages
- **SC-002**: `npm run test` from root runs tests for all packages
- **SC-003**: `npm run type-check` from root type-checks all packages without errors
- **SC-004**: Per-workspace targeting works: `npm run lint --workspace=backend`
- **SC-005**: PostToolUse hook formats and fixes written files

## Assumptions

- All packages use compatible ESLint and TypeScript versions (ESLint 8.x, TypeScript 5.3.3)
- Node.js 20.x and npm 10.x are available
- Existing package scripts (type-check, test) continue to work unchanged

## Dependencies

- No feature dependencies - this is infrastructure

## Scope Boundaries

### In Scope

- Root package.json with workspaces configuration
- Root scripts: lint, lint:fix, type-check, test
- ESLint configs for worker and observability services
- lint:fix scripts for all packages
- PostToolUse hook update for ESLint
- CLAUDE.md documentation update

### Out of Scope

- Shared ESLint config package (using standalone configs per service)
- TypeScript project references
- CI/CD pipeline updates
- pnpm or yarn migration
