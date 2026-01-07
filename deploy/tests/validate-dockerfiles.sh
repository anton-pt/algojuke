#!/usr/bin/env bash
#
# Validates Dockerfile syntax and structure for production requirements.
# Tests acceptance criteria from spec 039-docker-cloud-run.
#
# Usage: ./validate-dockerfiles.sh
#
# Exit codes:
#   0 - All validations passed
#   1 - One or more validations failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

FAILED=0
PASSED=0

# Log functions
pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++)) || true
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++)) || true
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

info() {
    echo -e "[INFO] $1"
}

# Check if file exists
check_file_exists() {
    local file="$1"
    local description="$2"

    if [[ -f "$file" ]]; then
        pass "$description exists: $file"
        return 0
    else
        fail "$description missing: $file"
        return 1
    fi
}

# Check for multi-stage build pattern (FROM ... AS ...)
check_multistage_build() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '^FROM .+ AS ' "$dockerfile"; then
        pass "$service Dockerfile uses multi-stage build"
        return 0
    else
        fail "$service Dockerfile missing multi-stage build (expected 'FROM ... AS ...' pattern)"
        return 1
    fi
}

# Check for Node.js 20 Alpine base image
check_node_alpine() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '^FROM node:20.*-alpine' "$dockerfile"; then
        pass "$service Dockerfile uses Node.js 20 Alpine base"
        return 0
    else
        fail "$service Dockerfile should use node:20-alpine base image"
        return 1
    fi
}

# Check for non-root user configuration
check_nonroot_user() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '(USER [a-z]+|--chown=)' "$dockerfile"; then
        pass "$service Dockerfile configures non-root user"
        return 0
    else
        fail "$service Dockerfile should run as non-root user for security"
        return 1
    fi
}

# Check for HEALTHCHECK instruction
check_healthcheck() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '^HEALTHCHECK' "$dockerfile"; then
        pass "$service Dockerfile has HEALTHCHECK instruction"
        return 0
    else
        fail "$service Dockerfile missing HEALTHCHECK instruction"
        return 1
    fi
}

# Check for production-only dependencies (npm ci --only=production or npm ci --omit=dev)
check_production_deps() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '(npm ci.*--omit=dev|npm ci.*--only=production|npm ci --production|NODE_ENV=production.*npm ci)' "$dockerfile"; then
        pass "$service Dockerfile installs production dependencies only"
        return 0
    else
        warn "$service Dockerfile may install dev dependencies (check npm ci flags)"
        return 0  # Warning only, not a hard failure
    fi
}

# Check for correct EXPOSE port
check_expose_port() {
    local dockerfile="$1"
    local service="$2"
    local expected_port="$3"

    if grep -qE "^EXPOSE $expected_port" "$dockerfile"; then
        pass "$service Dockerfile exposes port $expected_port"
        return 0
    else
        fail "$service Dockerfile should expose port $expected_port"
        return 1
    fi
}

# Check builder stage has build step
check_build_step() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE '(npm run build|tsc|npx tsc)' "$dockerfile"; then
        pass "$service Dockerfile has TypeScript build step"
        return 0
    else
        fail "$service Dockerfile missing build step (npm run build or tsc)"
        return 1
    fi
}

# Check that final stage copies from builder
check_copy_from_builder() {
    local dockerfile="$1"
    local service="$2"

    if grep -qE 'COPY --from=(builder|build)' "$dockerfile"; then
        pass "$service Dockerfile copies artifacts from builder stage"
        return 0
    else
        fail "$service Dockerfile should copy from builder stage"
        return 1
    fi
}

# Validate Dockerfile with docker build --check if available
validate_with_docker() {
    local dockerfile="$1"
    local context="$2"
    local service="$3"

    if ! command -v docker &> /dev/null; then
        warn "Docker not available, skipping docker build --check for $service"
        return 0
    fi

    # Try docker build --check (BuildKit feature, may not be available)
    if docker build --check -f "$dockerfile" "$context" &> /dev/null 2>&1; then
        pass "$service Dockerfile passes docker build --check"
        return 0
    elif docker buildx build --check -f "$dockerfile" "$context" &> /dev/null 2>&1; then
        pass "$service Dockerfile passes docker buildx build --check"
        return 0
    else
        # Fall back to syntax-only parsing
        info "docker build --check not available, skipping syntax validation for $service"
        return 0
    fi
}

# Validate with hadolint if available
validate_with_hadolint() {
    local dockerfile="$1"
    local service="$2"

    if ! command -v hadolint &> /dev/null; then
        warn "hadolint not available, skipping linting for $service (install with: brew install hadolint)"
        return 0
    fi

    local output
    if output=$(hadolint "$dockerfile" 2>&1); then
        pass "$service Dockerfile passes hadolint"
        return 0
    else
        warn "$service Dockerfile has hadolint warnings:"
        echo "$output" | head -10
        return 0  # Warning only
    fi
}

echo "============================================"
echo "Dockerfile Validation for Feature #39"
echo "============================================"
echo ""

# Define expected Dockerfile locations
BACKEND_DOCKERFILE="$PROJECT_ROOT/backend/Dockerfile"
WORKER_DOCKERFILE="$PROJECT_ROOT/services/worker/Dockerfile"

# --- Backend Dockerfile Validation ---
echo "--- Backend Service ---"

if check_file_exists "$BACKEND_DOCKERFILE" "Backend Dockerfile"; then
    check_multistage_build "$BACKEND_DOCKERFILE" "Backend"
    check_node_alpine "$BACKEND_DOCKERFILE" "Backend"
    check_nonroot_user "$BACKEND_DOCKERFILE" "Backend"
    check_healthcheck "$BACKEND_DOCKERFILE" "Backend"
    check_production_deps "$BACKEND_DOCKERFILE" "Backend"
    check_expose_port "$BACKEND_DOCKERFILE" "Backend" "4000"
    check_build_step "$BACKEND_DOCKERFILE" "Backend"
    check_copy_from_builder "$BACKEND_DOCKERFILE" "Backend"
    validate_with_hadolint "$BACKEND_DOCKERFILE" "Backend"
fi

echo ""

# --- Worker Dockerfile Validation ---
echo "--- Worker Service ---"

if check_file_exists "$WORKER_DOCKERFILE" "Worker Dockerfile"; then
    check_multistage_build "$WORKER_DOCKERFILE" "Worker"
    check_node_alpine "$WORKER_DOCKERFILE" "Worker"
    check_nonroot_user "$WORKER_DOCKERFILE" "Worker"
    check_healthcheck "$WORKER_DOCKERFILE" "Worker"
    check_production_deps "$WORKER_DOCKERFILE" "Worker"
    check_expose_port "$WORKER_DOCKERFILE" "Worker" "3001"
    check_build_step "$WORKER_DOCKERFILE" "Worker"
    check_copy_from_builder "$WORKER_DOCKERFILE" "Worker"
    validate_with_hadolint "$WORKER_DOCKERFILE" "Worker"
fi

echo ""
echo "============================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "============================================"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
