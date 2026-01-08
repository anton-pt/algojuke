# Research: Monorepo structure with npm workspaces

**Date**: 2026-01-08
**Feature**: ALG-28
**Implementation Guidance**: Implementation based on Turbo (https://turborepo.com/docs)

## Executive Summary

Use Turborepo on top of npm workspaces to gain parallel task execution, intelligent caching, and better developer experience. Turbo handles task orchestration while npm workspaces handles package management.

## Key Decisions

### 1. Use Turborepo for Task Orchestration

**Decision**: Add Turborepo as a dev dependency and use `turbo run` for all root scripts.

**Rationale**:

- Automatic parallelization of independent tasks across packages
- Local caching speeds up repeated runs (no re-lint if files unchanged)
- Better terminal output with progress indicators
- Filtering support for targeting specific packages (`--filter=backend`)
- Industry standard for monorepos (Vercel, Meta, etc.)

**Alternatives Considered**:

- Plain npm workspaces (`npm run lint --workspaces`): Works but runs sequentially, no caching, worse DX
- Lerna: Legacy tool, less actively maintained, more complex setup
- Nx: More opinionated, heavier, overkill for 5 packages

### 2. Task Caching Strategy

**Decision**: Enable caching for lint, lint:fix, type-check, and test tasks.

**Rationale**:

- Lint/type-check: Same source files = same results, safe to cache
- Tests: Cache by default, can be bypassed with `--force` when needed
- Turbo's content-aware hashing ensures cache invalidation when files change

**Configuration**:

```json
{
  "tasks": {
    "lint": {},
    "lint:fix": { "cache": false },
    "type-check": {},
    "test": {}
  }
}
```

Note: `lint:fix` has `cache: false` because it modifies files (side effect).

### 3. No Task Dependencies

**Decision**: Configure lint, type-check, and test as independent tasks with no `dependsOn`.

**Rationale**:

- These packages don't import from each other at build time
- No `build` step is required before lint/type-check/test
- Maximum parallelization: all packages run simultaneously

**If dependencies existed**:

```json
{
  "type-check": {
    "dependsOn": ["^build"] // Would wait for deps to build first
  }
}
```

### 4. Filtering Approach

**Decision**: Use Turbo's `--filter` flag for package targeting instead of npm's `--workspace`.

**Rationale**:

- More powerful: supports globs, dependencies, git-based filtering
- Consistent with Turbo's ecosystem
- Examples:
  - `turbo run lint --filter=backend` - single package
  - `turbo run lint --filter="./services/*"` - directory pattern
  - `turbo run test --filter=[HEAD^1]` - changed since last commit

## Implementation Pattern

### Root package.json

```json
{
  "name": "algojuke",
  "private": true,
  "workspaces": [
    "backend",
    "frontend",
    "services/worker",
    "services/search-index",
    "services/observability"
  ],
  "scripts": {
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "type-check": "turbo run type-check",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.3.0"
  }
}
```

### turbo.json

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "lint": {},
    "lint:fix": {
      "cache": false
    },
    "type-check": {},
    "test": {}
  }
}
```

### .gitignore Addition

```gitignore
# Turbo
.turbo
```

## Files to Modify

| File                                          | Change                               |
| --------------------------------------------- | ------------------------------------ |
| `package.json` (NEW)                          | Root with workspaces + turbo scripts |
| `turbo.json` (NEW)                            | Task configuration                   |
| `.gitignore`                                  | Add `.turbo` cache directory         |
| `backend/package.json`                        | Add `lint:fix` script                |
| `frontend/package.json`                       | Add `lint:fix` script                |
| `services/worker/package.json`                | Add `lint`, `lint:fix`, ESLint deps  |
| `services/worker/.eslintrc.json` (NEW)        | ESLint config                        |
| `services/search-index/package.json`          | Add `lint`, `lint:fix`               |
| `services/observability/package.json`         | Add `lint`, `lint:fix`, ESLint deps  |
| `services/observability/.eslintrc.json` (NEW) | ESLint config                        |
| `.claude/settings.json`                       | Add ESLint to PostToolUse hook       |
| `CLAUDE.md`                                   | Document turbo commands              |

## Command Examples

```bash
# Run across all packages (parallel)
npm run lint              # turbo run lint
npm run test              # turbo run test

# Target specific package
npm run lint -- --filter=backend
npm run test -- --filter="./services/*"

# Force re-run (ignore cache)
npm run test -- --force

# See what would run
npm run lint -- --dry-run
```

## Verification

```bash
# After implementation
npm install
npm run lint              # Should run all 5 packages in parallel
npm run lint              # Second run should be cached (fast)
npm run test -- --filter=backend  # Should only run backend tests
```
