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

3. Create GitHub issue and extract issue number:

   ```bash
   # Note: gh issue create returns URL directly (no --json flag needed)
   ISSUE_URL=$(gh issue create \
     --title "feat: ${FEATURE_TITLE}" \
     --body "${FEATURE_SUMMARY}

   See specification for full details.")

   # Extract issue number from URL (e.g., https://github.com/owner/repo/issues/39 -> 39)
   ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
   ```

4. Create feature directory and branch:
   IMPORTANT: The directory number MUST match the GitHub issue number exactly.
   Use zero-padded 3-digit format (e.g., 039 for issue #39).

   ```bash
   FEATURE_NAME=short-kebab-name  # Derived from title
   PADDED_NUM=$(printf "%03d" ${ISSUE_NUM})  # Zero-pad to 3 digits
   mkdir -p specs/${PADDED_NUM}-${FEATURE_NAME}
   git checkout -b ${PADDED_NUM}-${FEATURE_NAME}
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
   Use PADDED_NUM (from step 4) for directory paths, ISSUE_NUM for GitHub references.

   ```bash
   git add specs/${PADDED_NUM}-${FEATURE_NAME}/spec.md
   git commit -m "spec: #${ISSUE_NUM} - initial specification"

   # Update issue body to link to spec file on branch
   gh issue edit ${ISSUE_NUM} --body "$(cat <<EOF
   ${FEATURE_SUMMARY}

   **Specification**: [spec.md](../blob/${PADDED_NUM}-${FEATURE_NAME}/specs/${PADDED_NUM}-${FEATURE_NAME}/spec.md)
   EOF
   )"
   ```

7. Output:
   - "Created issue #${ISSUE_NUM}: ${FEATURE_TITLE}"
   - "Created spec at specs/${PADDED_NUM}-${FEATURE_NAME}/spec.md"
   - "Switched to branch ${PADDED_NUM}-${FEATURE_NAME}"

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
