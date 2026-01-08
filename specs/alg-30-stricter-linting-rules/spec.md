# Feature Specification: Implement Stricter Linting Rules

**Feature Branch**: `alg-30-stricter-linting-rules`
**Created**: 2026-01-08
**Status**: Draft
**Linear Issue**: [ALG-30](https://linear.app/algojuke/issue/ALG-30)
**Input**: Some linting rules implemented in ALG-28 were disabled because of existing technical debt. Investigate these linting rules, make the linter checks stricter, and resolve all linting errors that arise.

## Clarifications

### Session 2026-01-08

- Q: Fix all 289 errors now or phased approach? -> A: Fix all 289 errors now
- Q: Upgrade warn-level rules to error? -> A: Yes, upgrade to error
- Q: Apply strict rules to frontend as well? -> A: Yes, both backend and frontend

## User Scenarios & Testing

### User Story 1 - Strict Type-Checking in Backend (Priority: P1)

As a developer, I want strict type-checking rules enabled in the backend so that type errors are caught at lint time rather than runtime.

**Why this priority**: Core value of TypeScript - catching unsafe type operations before they cause runtime errors.

**Independent Test**: Run `npm run lint -- --filter=backend` and verify zero errors with all 9 strict rules enabled.

**Acceptance Scenarios**:

1. **Given** the backend ESLint config has strict type-checking rules enabled, **When** I run `npm run lint`, **Then** there are no errors from `no-unsafe-*`, `no-floating-promises`, `no-misused-promises`, `require-await`, or `restrict-template-expressions` rules
2. **Given** a developer writes code with an unsafe `any` type, **When** they run lint, **Then** they see an error (not a warning)
3. **Given** a developer writes an async function without await, **When** they run lint, **Then** they see an error

---

### User Story 2 - Warnings Upgraded to Errors (Priority: P2)

As a developer, I want `no-explicit-any` and `no-unused-vars` to be errors so that they cannot accumulate as technical debt.

**Why this priority**: Warnings are often ignored; errors enforce discipline.

**Independent Test**: Introduce an `any` type in backend code and verify lint fails.

**Acceptance Scenarios**:

1. **Given** a backend file with an unused import, **When** I run lint, **Then** I see an error (not a warning)
2. **Given** a backend file with `any` type, **When** I run lint, **Then** I see an error (not a warning)
3. **Given** the current codebase, **When** I run `npm run lint`, **Then** there are zero warnings (all are either fixed or errors)

---

### User Story 3 - Consistent Frontend Rules (Priority: P3)

As a developer, I want the frontend to have the same strict type-checking rules so that both packages have consistent code quality.

**Why this priority**: Consistency across packages reduces cognitive load.

**Independent Test**: Run `npm run lint -- --filter=frontend` and verify zero errors with strict rules.

**Acceptance Scenarios**:

1. **Given** the frontend ESLint config extends `recommended-requiring-type-checking`, **When** I run lint, **Then** there are no type-checking errors
2. **Given** React hook dependency warnings exist, **When** I fix them, **Then** lint passes with zero warnings
3. **Given** a developer writes code with `any` type in frontend, **When** they run lint, **Then** they see an error

---

## Edge Cases

- **eslint-disable comments**: 10 existing eslint-disable comments remain untouched - they are documented exceptions for library/framework edge cases
- **Union type resolvers**: GraphQL union type resolvers require careful typing to satisfy both GraphQL and TypeScript
- **Express async handlers**: Express route handlers need explicit void wrapping to satisfy `no-misused-promises`
- **Third-party library types**: Some libraries (Inngest, JSON:API) have loose types requiring type assertions

## Requirements

### Functional Requirements

- **FR-001**: All `no-unsafe-*` rules MUST be enabled at error level in backend
- **FR-002**: `no-floating-promises` and `no-misused-promises` MUST be enabled at error level
- **FR-003**: `require-await` and `restrict-template-expressions` MUST be enabled at error level
- **FR-004**: `no-explicit-any` MUST be error (not warn) in backend and frontend
- **FR-005**: `no-unused-vars` MUST be error (not warn) in backend
- **FR-006**: Frontend MUST extend `plugin:@typescript-eslint/recommended-requiring-type-checking`
- **FR-007**: `npm run lint` MUST pass with zero errors and zero warnings

### Key Entities

- **ESLint Rule**: A linting rule that can be set to off, warn, or error
- **Type-Checking Rule**: ESLint rules that require TypeScript project information
- **Technical Debt**: Code patterns that don't follow best practices but were allowed temporarily

## Success Criteria

- **SC-001**: `npm run lint` passes with exit code 0
- **SC-002**: Backend config has 9 previously-off rules enabled at error level
- **SC-003**: Backend and frontend configs have `no-explicit-any` at error level
- **SC-004**: Frontend config extends `recommended-requiring-type-checking`
- **SC-005**: No new eslint-disable comments added (same 10 as before)

## Assumptions

- Existing tests continue to pass (type changes don't affect runtime behavior)
- The 10 existing eslint-disable comments are justified and remain
- Services (worker, search-index, observability) already have strict rules and require no changes

## Dependencies

- **@specs/alg-28-monorepo-structure-with-npm-workspaces**: Monorepo structure with unified lint commands (completed)

## Scope Boundaries

### In Scope

- Backend ESLint config update to enable 9 strict rules
- Backend source code fixes (~289 errors)
- Frontend ESLint config update to add type-checking extension
- Frontend source code fixes (3 warnings)
- Upgrading warn-level rules to error

### Out of Scope

- Removing or justifying existing eslint-disable comments
- Adding rules stricter than what services already use
- Refactoring code structure (only type annotation changes)
- Changes to services (worker, search-index, observability) - already strict
