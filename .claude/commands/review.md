# Code Simplification Pass

## Steps

1. Find recently modified files:

   ```bash
   git diff --name-only HEAD~10 | grep -E '\.(ts|tsx)$' | grep -v '\.test\.'
   ```

2. For each file, review and simplify:
   - Remove unused imports
   - Simplify overly complex logic
   - Remove redundant type annotations
   - Ensure consistent naming

3. Do NOT:
   - Add new features
   - Change behavior
   - Add comments or documentation

4. Run tests after each change to ensure nothing breaks

5. Commit simplifications:
   ```bash
   git commit -m "refactor: simplify recent changes"
   ```
