# Run Full Verification

## Steps

1. Run type checking across all workspaces:

   ```bash
   npm run type-check --workspaces --if-present
   ```

2. Run all tests:

   ```bash
   npm test --workspaces --if-present
   ```

3. Report results:
   - If all pass: "✓ Verification complete"
   - If failures: List failing tests/type errors
