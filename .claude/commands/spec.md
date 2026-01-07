# Create Feature Specification and GitHub Issue

## Input
Feature description from user: $ARGUMENTS
Example: "Add dark mode toggle to settings page"

## Steps
1. Analyze the feature description and ask up to 5 clarifying questions using AskUserQuestion:
   - Ambiguous requirements
   - Missing acceptance criteria
   - Unclear scope boundaries
   - Technical constraints not mentioned
   - Priority/order of user stories

2. After clarification, generate a feature title and summary:
   - Title: concise (5-10 words), suitable for GitHub issue
   - Summary: 2-3 sentences describing the feature

3. Create GitHub issue:
   ```bash
   ISSUE_URL=$(gh issue create \
     --title "feat: ${FEATURE_TITLE}" \
     --body "${FEATURE_SUMMARY}

   See specs/${ISSUE_NUM}-${FEATURE_NAME}/spec.md for full specification." \
     --json url -q '.url')

   ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
   ```

4. Create feature directory and branch:
   ```bash
   FEATURE_NAME=short-kebab-name  # Derived from title
   mkdir -p specs/${ISSUE_NUM}-${FEATURE_NAME}
   git checkout -b ${ISSUE_NUM}-${FEATURE_NAME}
   ```

5. Generate spec.md incorporating:
   - Summary (same as issue title)
   - User stories derived from clarified requirements (prioritized P1, P2, P3)
     - Each with acceptance scenarios (Given/When/Then)
   - Functional requirements (FR-001, FR-002, etc.)
   - Dependencies (links to other specs if relevant)
   - Scope boundaries (in/out of scope)
   - Clarifications section (Q&A from step 1)
   - Link to GitHub issue

6. Commit and update issue:
   ```bash
   git add specs/${ISSUE_NUM}-${FEATURE_NAME}/spec.md
   git commit -m "spec: #${ISSUE_NUM} - initial specification"

   # Update issue body to link to spec file on branch
   gh issue edit ${ISSUE_NUM} --body "$(cat <<EOF
   ${FEATURE_SUMMARY}

   **Specification**: [spec.md](../blob/${ISSUE_NUM}-${FEATURE_NAME}/specs/${ISSUE_NUM}-${FEATURE_NAME}/spec.md)
   EOF
   )"
   ```

7. Output:
   - "Created issue #${ISSUE_NUM}: ${FEATURE_TITLE}"
   - "Created spec at specs/${ISSUE_NUM}-${FEATURE_NAME}/spec.md"
   - "Switched to branch ${ISSUE_NUM}-${FEATURE_NAME}"

## Clarifying Questions Guidelines
Focus on questions that will:
- Disambiguate vague requirements
- Surface hidden assumptions
- Define edge cases
- Establish priority order
- Clarify data flows and user interactions

Avoid questions that:
- Can be answered by reading the codebase
- Are purely technical implementation details (save for /research)
- Have obvious answers from context
