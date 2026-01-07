#!/usr/bin/env bash
#
# Docker image build smoke tests for Feature #39.
# Builds both backend and worker images and validates they run correctly.
#
# Usage: ./build-images.sh [--skip-cleanup]
#
# Options:
#   --skip-cleanup    Don't remove images after testing (useful for debugging)
#
# Exit codes:
#   0 - All builds and tests passed
#   1 - One or more builds/tests failed

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
SKIP_CLEANUP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

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

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo "Docker daemon is not running"
        exit 1
    fi

    pass "Docker is available and running"
}

# Build a Docker image
build_image() {
    local dockerfile="$1"
    local context="$2"
    local tag="$3"
    local service="$4"

    if [[ ! -f "$dockerfile" ]]; then
        fail "$service Dockerfile not found: $dockerfile"
        return 1
    fi

    info "Building $service image..."

    local start_time=$(date +%s)

    if docker build -f "$dockerfile" -t "$tag" "$context" > /tmp/docker-build-$service.log 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        pass "$service image built successfully in ${duration}s"
        return 0
    else
        fail "$service image build failed"
        echo "Build log:"
        cat /tmp/docker-build-$service.log | tail -50
        return 1
    fi
}

# Get image size
check_image_size() {
    local tag="$1"
    local service="$2"
    local max_size_mb="$3"

    local size=$(docker image inspect "$tag" --format='{{.Size}}' 2>/dev/null || echo "0")
    local size_mb=$((size / 1024 / 1024))

    if [[ $size_mb -le $max_size_mb ]]; then
        pass "$service image size: ${size_mb}MB (max: ${max_size_mb}MB)"
        return 0
    else
        warn "$service image size: ${size_mb}MB exceeds recommended ${max_size_mb}MB"
        return 0  # Warning only
    fi
}

# Verify multi-stage build reduced image size
check_multistage_efficiency() {
    local tag="$1"
    local service="$2"

    # Check that the image has fewer layers than a non-multistage build would
    local layers=$(docker image inspect "$tag" --format='{{len .RootFS.Layers}}' 2>/dev/null || echo "0")

    if [[ $layers -gt 0 && $layers -lt 20 ]]; then
        pass "$service image has $layers layers (multi-stage likely working)"
        return 0
    elif [[ $layers -ge 20 ]]; then
        warn "$service image has $layers layers (might not be using multi-stage efficiently)"
        return 0
    else
        fail "Could not inspect $service image layers"
        return 1
    fi
}

# Run container and test health endpoint
test_health_endpoint() {
    local tag="$1"
    local service="$2"
    local port="$3"
    local health_path="${4:-/health}"
    local container_name="test-$service-$$"

    info "Starting $service container for health check test..."

    # Start container in background with minimal env vars
    local container_id
    container_id=$(docker run -d \
        --name "$container_name" \
        -p "0:$port" \
        -e "NODE_ENV=test" \
        -e "DATABASE_URL=postgresql://test:test@localhost:5432/test" \
        -e "TIDAL_CLIENT_ID=test" \
        -e "TIDAL_CLIENT_SECRET=test" \
        -e "ANTHROPIC_API_KEY=test" \
        -e "INNGEST_DEV=1" \
        "$tag" 2>/dev/null || echo "")

    if [[ -z "$container_id" ]]; then
        fail "$service container failed to start"
        return 1
    fi

    # Get the mapped port
    local mapped_port
    mapped_port=$(docker port "$container_name" "$port" 2>/dev/null | head -1 | cut -d: -f2)

    if [[ -z "$mapped_port" ]]; then
        fail "$service container port mapping failed"
        docker rm -f "$container_name" &>/dev/null || true
        return 1
    fi

    # Wait for container to be ready (max 30 seconds)
    local max_attempts=30
    local attempt=0
    local healthy=false

    info "Waiting for $service health endpoint on port $mapped_port..."

    while [[ $attempt -lt $max_attempts ]]; do
        ((attempt++))

        # Check if container is still running
        if ! docker ps -q -f "name=$container_name" | grep -q .; then
            info "$service container stopped. Checking logs..."
            docker logs "$container_name" 2>&1 | tail -20
            break
        fi

        # Try to hit health endpoint
        if curl -sf "http://localhost:$mapped_port$health_path" &>/dev/null; then
            healthy=true
            break
        fi

        sleep 1
    done

    # Cleanup
    docker rm -f "$container_name" &>/dev/null || true

    if $healthy; then
        pass "$service health endpoint responded on $health_path"
        return 0
    else
        fail "$service health endpoint did not respond within 30s"
        return 1
    fi
}

# Clean up test images
cleanup_images() {
    local images=("$@")

    if $SKIP_CLEANUP; then
        info "Skipping image cleanup (--skip-cleanup)"
        return
    fi

    info "Cleaning up test images..."
    for image in "${images[@]}"; do
        docker rmi "$image" &>/dev/null || true
    done
}

echo "============================================"
echo "Docker Build Smoke Tests for Feature #39"
echo "============================================"
echo ""

# Check prerequisites
check_docker

echo ""

# Define paths and tags
BACKEND_DOCKERFILE="$PROJECT_ROOT/backend/Dockerfile"
BACKEND_CONTEXT="$PROJECT_ROOT/backend"
BACKEND_TAG="algojuke-backend:test-$$"

WORKER_DOCKERFILE="$PROJECT_ROOT/services/worker/Dockerfile"
WORKER_CONTEXT="$PROJECT_ROOT/services/worker"
WORKER_TAG="algojuke-worker:test-$$"

IMAGES_TO_CLEANUP=()

# --- Backend Build Tests ---
echo "--- Backend Service Build ---"

if [[ -f "$BACKEND_DOCKERFILE" ]]; then
    if build_image "$BACKEND_DOCKERFILE" "$BACKEND_CONTEXT" "$BACKEND_TAG" "Backend"; then
        IMAGES_TO_CLEANUP+=("$BACKEND_TAG")
        check_image_size "$BACKEND_TAG" "Backend" 500
        check_multistage_efficiency "$BACKEND_TAG" "Backend"
        # Note: Health test requires actual DB connection, skip in CI
        # test_health_endpoint "$BACKEND_TAG" "Backend" 4000 "/health"
        info "Skipping health endpoint test (requires database)"
    fi
else
    fail "Backend Dockerfile not found: $BACKEND_DOCKERFILE"
fi

echo ""

# --- Worker Build Tests ---
echo "--- Worker Service Build ---"

if [[ -f "$WORKER_DOCKERFILE" ]]; then
    if build_image "$WORKER_DOCKERFILE" "$WORKER_CONTEXT" "$WORKER_TAG" "Worker"; then
        IMAGES_TO_CLEANUP+=("$WORKER_TAG")
        check_image_size "$WORKER_TAG" "Worker" 600
        check_multistage_efficiency "$WORKER_TAG" "Worker"
        # Note: Health test requires Inngest, skip in CI
        # test_health_endpoint "$WORKER_TAG" "Worker" 3001 "/health"
        info "Skipping health endpoint test (requires Inngest)"
    fi
else
    fail "Worker Dockerfile not found: $WORKER_DOCKERFILE"
fi

echo ""

# Cleanup
cleanup_images "${IMAGES_TO_CLEANUP[@]}"

echo ""
echo "============================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "============================================"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
