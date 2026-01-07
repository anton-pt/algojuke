#!/usr/bin/env bash
#
# Runs all validation tests for Feature #39 Docker/Cloud Run infrastructure.
#
# Usage: ./run-all.sh [--skip-build]
#
# Options:
#   --skip-build    Skip the Docker build tests (faster for CI validation only)
#
# Exit codes:
#   0 - All validations passed
#   1 - One or more validations failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SKIP_BUILD=false
FAILED_SUITES=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

run_suite() {
    local name="$1"
    local script="$2"

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Running: $name${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    if "$script"; then
        echo -e "${GREEN}$name: PASSED${NC}"
    else
        echo -e "${RED}$name: FAILED${NC}"
        ((FAILED_SUITES++)) || true
    fi
}

echo "============================================"
echo "Feature #39: Docker & Cloud Run Validation"
echo "============================================"
echo ""
echo "Test suites:"
echo "  1. Dockerfile validation"
echo "  2. Cloud Run YAML validation"
echo "  3. GitHub Actions workflow validation"
if ! $SKIP_BUILD; then
    echo "  4. Docker build smoke tests"
fi
echo ""

# Run validation suites
run_suite "Dockerfile Validation" "$SCRIPT_DIR/validate-dockerfiles.sh"
run_suite "Cloud Run YAML Validation" "$SCRIPT_DIR/validate-cloudrun.sh"
run_suite "GitHub Actions Workflow Validation" "$SCRIPT_DIR/validate-workflows.sh"

if ! $SKIP_BUILD; then
    run_suite "Docker Build Smoke Tests" "$SCRIPT_DIR/build-images.sh"
else
    echo ""
    echo -e "${YELLOW}Skipping Docker build tests (--skip-build)${NC}"
fi

echo ""
echo "============================================"
echo "Final Results"
echo "============================================"

if [[ $FAILED_SUITES -gt 0 ]]; then
    echo -e "${RED}$FAILED_SUITES test suite(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}All test suites passed${NC}"
    exit 0
fi
