# Implement Feature with Interleaved Testing

## Steps

1. **Get current feature from branch**:

   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   NUM=$(echo "$BRANCH" | grep -oE 'alg-([0-9]+)' | grep -oE '[0-9]+')
   ```

2. **Read context**:
   - `specs/alg-${NUM}-*/spec.md` - User stories, requirements, acceptance criteria
   - `specs/alg-${NUM}-*/research.md` - Implementation patterns, files to modify

3. **Implement user stories in priority order** (P1 first, then P2, P3):

   For each user story:

   a. **Implement the functionality**:
   - Follow patterns from research.md
   - Use existing codebase conventions
   - Keep changes focused on the story

   b. **Commit implementation** with explicit file paths:

   ```bash
   git commit -m "spec: ALG-${NUM} - {description}" -- path/to/file1.ts path/to/file2.ts
   ```

   Using explicit paths prevents accidentally including test files.

   c. **Write unit tests** for the implementation:
   - Test the public interface
   - Cover edge cases from spec
   - Follow existing test patterns in the codebase

   d. **Write integration tests** if the story involves:
   - Multiple components working together
   - Database operations
   - External API calls
   - End-to-end flows

   e. **Run tests to verify**:

   ```bash
   npm test --workspaces --if-present
   ```

   f. **Commit tests** with explicit file paths:

   ```bash
   git commit -m "test: ALG-${NUM} - {description}" -- tests/path/to/test.ts
   ```

4. **Final verification**:
   ```bash
   npm run type-check --workspaces --if-present
   npm test --workspaces --if-present
   ```

## Commit Convention

```bash
# Implementation commits (use explicit file paths)
git commit -m "spec: ALG-27 - add semantic search service" -- backend/src/services/search.ts

# Test commits (use explicit file paths)
git commit -m "test: ALG-27 - add semantic search tests" -- backend/tests/services/search.test.ts
```

## Testing Guidelines

**Unit Tests**:

- Test individual functions/methods
- Mock external dependencies
- Focus on behavior, not implementation

**Integration Tests** (when needed):

- Test component interactions
- Use test database if DB operations involved
- Test API endpoints end-to-end

## Notes

- Do NOT batch all implementation then all tests - interleave them
- Each story should have passing tests before moving to the next
- If tests fail, fix the implementation before continuing
- Follow acceptance scenarios from spec.md for test cases
