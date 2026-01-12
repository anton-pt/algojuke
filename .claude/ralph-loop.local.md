---
active: true
iteration: 1
max_iterations: 5
completion_promise: "IMPLEMENTATION"
started_at: "2026-01-12T20:23:31Z"
---

Implement the current feature with interleaved testing. Read specs/alg-76-move-tidal-search-under-library-management/spec.md for user stories and requirements. For each user story in priority order: first implement the functionality following existing patterns in the codebase, then commit with message like feat/scope: description ALG-76, then write unit tests, then write integration tests if needed, then run npm test --workspaces --if-present, then commit tests with message like test/scope: description ALG-76. When all stories are implemented and tests pass, run npm run type-check --workspaces --if-present and npm test --workspaces --if-present then output the completion promise tag with text IMPLEMENTATION COMPLETE inside. Do NOT batch implementation and tests - interleave them. COMPLETE
