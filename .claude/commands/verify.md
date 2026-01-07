# Run Full Verification

## Project Structure

This repository has no root package.json. Services are located at:
- `backend/`
- `frontend/`
- `services/worker/`
- `services/search-index/`
- `services/observability/`

## Steps

1. Run type checking on each service that has a `type-check` script:

   ```bash
   cd backend && npm run type-check
   cd services/worker && npm run type-check
   cd services/search-index && npm run type-check
   cd services/observability && npm run type-check
   ```

   Note: frontend uses a different build system; skip unless specifically needed.

2. Run tests on each service:

   ```bash
   cd backend && npm test
   cd services/worker && npm test
   cd services/search-index && npm test
   cd services/observability && npm test
   ```

3. If deploy/tests/ exists, run infrastructure validation:

   ```bash
   cd deploy/tests && ./run-all.sh --skip-build
   ```

4. Report results:
   - If all pass: "✓ Verification complete"
   - If failures: List failing tests/type errors with service name
