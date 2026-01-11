# Implement Feature with Interleaved Testing

This command uses Ralph Loop to iteratively implement features with interleaved testing.

**User arguments:** $ARGUMENTS

## Step 1: Parse Iterations

Extract the iteration count from user arguments (default: 5).

Look for patterns like "with 10 iterations", "10 iterations", or just "10" in the arguments.

```
Examples:
- "/implement-and-test with 10 iterations" → 10 iterations
- "/implement-and-test 15 iterations" → 15 iterations
- "/implement-and-test" → 5 iterations (default)
```

## Step 2: Start Ralph Loop

Start `/ralph-loop:ralph-loop` with the following prompt and options:

**Prompt:**

````
Implement the current feature with interleaved testing.

## Context

1. Get current feature from branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   NUM=$(echo "$BRANCH" | grep -oE 'alg-([0-9]+)' | grep -oE '[0-9]+')
````

2. Read context:
   - `specs/alg-${NUM}-*/spec.md` - User stories, requirements, acceptance criteria
   - `specs/alg-${NUM}-*/research.md` - Implementation patterns, files to modify

## Implementation Process

Implement user stories in priority order (P1 first, then P2, P3).

For each user story:

a. **Implement the functionality**:

- Follow patterns from research.md
- Use existing codebase conventions
- Keep changes focused on the story

b. **Commit implementation** using Conventional Commits:

```bash
git commit -m "feat(scope): description (ALG-${NUM})" -- path/to/file1.ts path/to/file2.ts
```

Types: feat, fix, refactor, perf, docs, chore
Scope: optional, e.g. feat(search):, fix(api):

c. **Write unit tests** for the implementation:

- Test the public interface
- Cover edge cases from spec
- Follow existing test patterns

d. **Write integration tests** if the story involves:

- Multiple components working together
- Database operations
- External API calls
- End-to-end flows

e. **Run tests to verify**:

```bash
npm test --workspaces --if-present
```

f. **Commit tests** using Conventional Commits:

```bash
git commit -m "test(scope): description (ALG-${NUM})" -- tests/path/to/test.ts
```

## Completion Criteria

When ALL user stories are implemented with passing tests, run final verification:

```bash
npm run type-check --workspaces --if-present
npm test --workspaces --if-present
```

If everything passes, output: <promise>IMPLEMENTATION COMPLETE</promise>

If there are failures, continue fixing them in the next iteration.

## Guidelines

- Do NOT batch all implementation then all tests - interleave them
- Each story should have passing tests before moving to the next
- If tests fail, fix the implementation before continuing
- Follow acceptance scenarios from spec.md for test cases

````

**Options:**
- `--max-iterations <parsed-count>` (default: 5)
- `--completion-promise "IMPLEMENTATION COMPLETE"`

## Testing Guidelines Reference

**Unit Tests:**
- Test individual functions/methods
- Mock external dependencies
- Focus on behavior, not implementation

**Integration Tests (when needed):**
- Test component interactions
- Use test database if DB operations involved
- Test API endpoints end-to-end

## Commit Convention Reference

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature commits
git commit -m "feat(search): add semantic search service (ALG-27)" -- backend/src/services/search.ts

# Bug fix commits
git commit -m "fix(api): handle null response from Tidal (ALG-27)" -- backend/src/services/tidal.ts

# Test commits
git commit -m "test(search): add semantic search tests (ALG-27)" -- backend/tests/services/search.test.ts

# Refactor commits
git commit -m "refactor(chat): extract message parsing logic (ALG-27)" -- backend/src/services/chat.ts
````

**Types:** `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `chore`, `ci`, `build`
