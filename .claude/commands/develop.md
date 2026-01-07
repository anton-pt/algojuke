# Parallel Implementation + Testing (Single Tab)

## Steps
1. Determine current feature from branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ISSUE_NUM=$(echo "$BRANCH" | grep -oE '^[0-9]+')
   ```

2. Read context for subagent prompts:
   - specs/${ISSUE_NUM}-*/spec.md
   - specs/${ISSUE_NUM}-*/research.md (if exists)

3. Launch parallel Task subagents using a single message with multiple tool calls:
   ```
   Task(subagent_type="general-purpose", prompt="Implementation agent: ...")
   Task(subagent_type="general-purpose", prompt="Test agent: ...")
   ```

4. Implementation subagent prompt:
   "You are implementing feature #${ISSUE_NUM}. Read specs/${ISSUE_NUM}-*/spec.md
   and research.md. Implement all user stories in priority order. Commit frequently
   with 'spec: #${ISSUE_NUM} - description'. Use explicit file paths in commits.
   Do NOT write tests."

5. Test subagent prompt:
   "You are writing tests for feature #${ISSUE_NUM}. Read specs/${ISSUE_NUM}-*/spec.md
   for acceptance scenarios. Watch git log for 'spec: #${ISSUE_NUM}' commits.
   Write tests covering the implementation. Commit with 'test: #${ISSUE_NUM} - description'.
   Use explicit test file paths in commits."

6. Wait for both subagents to complete (TaskOutput with block=true)

7. Run verification:
   ```bash
   npm run type-check --workspaces --if-present
   npm test --workspaces --if-present
   ```

8. Report results to user:
   - Summary of implementation commits
   - Summary of test commits
   - Verification status (pass/fail)
