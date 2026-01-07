# Write Tests for Recent Changes

## Steps
1. Find recent spec commits:
   ```bash
   git log --oneline -30 | grep "spec: #"
   ```

2. Extract issue number from most recent spec commit:
   ```bash
   ISSUE_NUM=$(git log --oneline -30 | grep "spec: #" | head -1 | grep -oE '#[0-9]+' | tr -d '#')
   ```

3. Read the spec for test requirements:
   - specs/${ISSUE_NUM}-*/spec.md
   - Focus on acceptance scenarios and functional requirements

4. See what changed since last test commit:
   ```bash
   LAST_TEST=$(git log --oneline | grep "^[a-f0-9]* test: #" | head -1 | cut -d' ' -f1)
   if [ -z "$LAST_TEST" ]; then
     git diff --name-only HEAD~10
   else
     git diff --name-only $LAST_TEST..HEAD
   fi
   ```

5. For each changed source file (excluding test files):
   - Read the file
   - Write tests covering the changes
   - Ensure tests verify spec requirements (acceptance scenarios)

6. Run tests to verify they pass:
   ```bash
   npm test
   ```

7. Commit with explicit test file paths:
   ```bash
   git commit -m "test: #${ISSUE_NUM} - tests for recent changes" -- path/to/test1.test.ts path/to/test2.test.ts
   ```

## Commit Protocol
ALWAYS commit with explicit file paths to avoid committing implementation files:
```bash
git commit -m "test: #123 - description" -- path/to/test1.test.ts path/to/test2.test.ts
```
