# Commit and Create Pull Request

## Steps
1. Determine current feature from branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ISSUE_NUM=$(echo "$BRANCH" | grep -oE '^[0-9]+')
   ```

2. Run verification:
   ```bash
   npm run type-check --workspaces --if-present
   npm test --workspaces --if-present
   ```

3. If verification fails, stop and report errors.

4. Push branch to remote:
   ```bash
   git push -u origin $BRANCH
   ```

5. Create PR with gh CLI:
   ```bash
   gh pr create \
     --title "feat: $(head -1 specs/${ISSUE_NUM}-*/spec.md | sed 's/^# //')" \
     --body "## Summary

   Closes #${ISSUE_NUM}

   See [spec.md](specs/${ISSUE_NUM}-*/spec.md) for full specification.

   ## Changes
   $(git log main..HEAD --oneline)

   ## Verification
   - [x] Type check passes
   - [x] Tests pass
   "
   ```
   Note: "Closes #${ISSUE_NUM}" will auto-close the issue when the PR is merged.

6. Output the PR URL for the user.
