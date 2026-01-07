# Document Technical Decisions

## Input
Optional implementation guidance: $ARGUMENTS
Examples:
- "Use React Query for data fetching"
- "Implement with Redis caching and 5-minute TTL"
- "Based on the pattern from feature #38"

## Steps
1. Determine current feature from branch:
   ```bash
   BRANCH=$(git rev-parse --abbrev-ref HEAD)
   ISSUE_NUM=$(echo "$BRANCH" | grep -oE '^[0-9]+')
   ```

2. Read the spec.md for the current feature:
   - specs/${ISSUE_NUM}-*/spec.md

3. If implementation guidance provided ($ARGUMENTS):
   - Incorporate the user's technology/approach preferences as constraints
   - Research how to apply those specific technologies to this feature

4. Research the codebase to understand:
   - Existing patterns to follow
   - Files that will need changes
   - Dependencies and constraints
   - How user's preferred technologies integrate with existing code

5. Create research.md with:
   - Executive summary
   - Implementation guidance (if provided by user)
   - Key decisions with:
     - Decision statement
     - Rationale (referencing user guidance if applicable)
     - Alternatives considered and why rejected
   - Implementation patterns (code snippets)
   - Files to modify

6. Commit:
   ```bash
   git add specs/${ISSUE_NUM}-*/research.md
   git commit -m "spec: #${ISSUE_NUM} - research and decisions"
   ```
