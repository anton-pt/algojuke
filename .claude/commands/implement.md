# Implement Feature

## Steps
1. Determine current feature from branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ISSUE_NUM=$(echo "$BRANCH" | grep -oE '^[0-9]+')
   ```

2. Read context:
   - specs/${ISSUE_NUM}-*/spec.md
   - specs/${ISSUE_NUM}-*/research.md (if exists)

3. Implement the feature:
   - Follow patterns from research.md
   - Implement user stories in priority order (P1 first)
   - Commit frequently with `spec: #${ISSUE_NUM} - description`

4. Do NOT write tests - the test agent handles that.

5. After each logical chunk of work, commit with explicit file paths:
   ```bash
   git commit -m "spec: #${ISSUE_NUM} - description of change" -- path/to/file1.ts path/to/file2.ts
   ```
   This prevents accidentally committing test files that the test agent may be working on.
