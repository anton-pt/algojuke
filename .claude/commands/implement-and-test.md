# Implement Feature with Interleaved Testing

This command delegates to Ralph Loop for iterative implementation with testing.

**User arguments:** $ARGUMENTS

## Instructions for Claude

You MUST follow these steps:

1. **Parse iteration count** from `$ARGUMENTS` (default: 5)
   - Patterns: "with 10 iterations" → 10, "10 iterations" → 10, "" → 5

2. **Get current feature number** from branch:

   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   NUM=$(echo "$BRANCH" | grep -oE 'alg-([0-9]+)' | grep -oE '[0-9]+')
   ```

3. **Check which spec files exist**:
   - Verify `specs/alg-${NUM}-*/spec.md` exists (REQUIRED)
   - Check if `specs/alg-${NUM}-*/research.md` exists (OPTIONAL)

4. **Invoke Ralph Loop with appropriate prompt**:

   **If research.md EXISTS**, use the Skill tool with:

   ```
   skill: "ralph-loop:ralph-loop"
   args: "Implement the current feature with interleaved testing. Read specs/alg-${NUM}-*/spec.md for user stories and requirements. Read specs/alg-${NUM}-*/research.md for implementation patterns and guidance. For each user story in priority order: first implement the functionality following the patterns from research.md, then commit with message like feat/scope: description ALG-${NUM}, then write unit tests, then write integration tests if needed, then run npm test --workspaces --if-present, then commit tests with message like test/scope: description ALG-${NUM}. When all stories are implemented and tests pass, run npm run type-check --workspaces --if-present and npm test --workspaces --if-present then output the completion promise tag with text IMPLEMENTATION COMPLETE inside. Do NOT batch implementation and tests - interleave them. --max-iterations ${COUNT} --completion-promise IMPLEMENTATION COMPLETE"
   ```

   **If research.md DOES NOT EXIST**, use the Skill tool with:

   ```
   skill: "ralph-loop:ralph-loop"
   args: "Implement the current feature with interleaved testing. Read specs/alg-${NUM}-*/spec.md for user stories and requirements. For each user story in priority order: first implement the functionality following existing patterns in the codebase, then commit with message like feat/scope: description ALG-${NUM}, then write unit tests, then write integration tests if needed, then run npm test --workspaces --if-present, then commit tests with message like test/scope: description ALG-${NUM}. When all stories are implemented and tests pass, run npm run type-check --workspaces --if-present and npm test --workspaces --if-present then output the completion promise tag with text IMPLEMENTATION COMPLETE inside. Do NOT batch implementation and tests - interleave them. --max-iterations ${COUNT} --completion-promise IMPLEMENTATION COMPLETE"
   ```

   Replace `${COUNT}` with the parsed iteration count and `${NUM}` with the feature number.

**CRITICAL:** Do NOT execute the prompt instructions directly. You MUST invoke the Ralph Loop skill using the Skill tool. Ralph Loop will handle the iterative implementation process.

---

## Reference: Implementation Process

Ralph Loop will follow this process:

1. **Read context files**:
   - `specs/alg-${NUM}-*/spec.md` - User stories, requirements, acceptance criteria (ALWAYS)
   - `specs/alg-${NUM}-*/research.md` - Implementation patterns, files to modify (IF PRESENT)

2. **For each user story** (P1 first, then P2, P3):
   - Implement functionality (following research.md if present, otherwise existing codebase patterns)
   - Commit: `git commit -m "feat/scope: description ALG-${NUM}"`
   - Write unit tests
   - Write integration tests (if multi-component, database, API, or e2e)
   - Run: `npm test --workspaces --if-present`
   - Commit: `git commit -m "test/scope: description ALG-${NUM}"`

3. **Completion verification**:
   - Run: `npm run type-check --workspaces --if-present`
   - Run: `npm test --workspaces --if-present`
   - Output completion promise tag with: `IMPLEMENTATION COMPLETE`

## Reference: Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

**Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `chore`, `ci`, `build`

**Examples:**

```bash
git commit -m "feat(search): add semantic search service (ALG-27)"
git commit -m "test(search): add semantic search tests (ALG-27)"
git commit -m "fix(api): handle null response from Tidal (ALG-27)"
```
