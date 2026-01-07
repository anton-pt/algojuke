#!/usr/bin/env bash
#
# Validates GitHub Actions workflows for Docker build and Cloud Run deployment.
# Tests acceptance criteria from spec 039-docker-cloud-run.
#
# Usage: ./validate-workflows.sh
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

# Check YAML contains a pattern
yaml_has_pattern() {
    local file="$1"
    local pattern="$2"
    grep -qE "$pattern" "$file"
}

# Validate workflow triggers on main branch
validate_main_trigger() {
    local file="$1"
    local workflow="$2"

    # Check for push trigger with main branch (handles multiple YAML formats)
    if yaml_has_pattern "$file" "on:" && yaml_has_pattern "$file" "push:"; then
        if yaml_has_pattern "$file" "(main|master)"; then
            pass "$workflow triggers on push to main branch"
            return 0
        fi
    fi

    fail "$workflow should trigger on push to main branch"
    return 1
}

# Validate GCP authentication
validate_gcp_auth() {
    local file="$1"
    local workflow="$2"

    # Check for Workload Identity Federation (OIDC) - preferred
    if yaml_has_pattern "$file" "(google-github-actions/auth|workload_identity_provider|id-token.*write)"; then
        pass "$workflow uses GCP Workload Identity Federation (OIDC)"
        return 0
    fi

    # Check for service account key - less secure but acceptable
    if yaml_has_pattern "$file" "(credentials_json|GOOGLE_CREDENTIALS|gcloud.*auth)"; then
        warn "$workflow uses service account key (consider OIDC for better security)"
        return 0
    fi

    fail "$workflow missing GCP authentication configuration"
    return 1
}

# Validate Docker build steps
validate_docker_build() {
    local file="$1"
    local workflow="$2"

    local has_docker_build=false
    local has_buildx=false
    local has_cache=false

    if yaml_has_pattern "$file" "docker.*build|docker/build-push-action"; then
        has_docker_build=true
    fi

    if yaml_has_pattern "$file" "(docker/setup-buildx-action|buildx)"; then
        has_buildx=true
    fi

    if yaml_has_pattern "$file" "(cache-from|cache-to|gha)"; then
        has_cache=true
    fi

    if $has_docker_build; then
        pass "$workflow has Docker build step"
    else
        fail "$workflow missing Docker build step"
    fi

    if $has_buildx; then
        pass "$workflow uses Docker Buildx"
    else
        warn "$workflow could use Docker Buildx for better caching"
    fi

    if $has_cache; then
        pass "$workflow has Docker layer caching configured"
    else
        warn "$workflow could benefit from Docker layer caching"
    fi
}

# Validate image tagging strategy
validate_image_tags() {
    local file="$1"
    local workflow="$2"

    local has_sha_tag=false
    local has_latest_tag=false

    if yaml_has_pattern "$file" "(sha|GITHUB_SHA|github.sha)"; then
        has_sha_tag=true
    fi

    if yaml_has_pattern "$file" "latest"; then
        has_latest_tag=true
    fi

    if $has_sha_tag; then
        pass "$workflow tags images with commit SHA"
    else
        fail "$workflow should tag images with commit SHA"
    fi

    if $has_latest_tag; then
        pass "$workflow tags images as latest"
    else
        warn "$workflow could tag images as latest for convenience"
    fi
}

# Validate Artifact Registry push
validate_artifact_registry() {
    local file="$1"
    local workflow="$2"

    if yaml_has_pattern "$file" "(docker\.pkg\.dev|artifact.*registry|gcr\.io)"; then
        pass "$workflow pushes to GCP container registry"
        return 0
    fi

    fail "$workflow should push to GCP Artifact Registry"
    return 1
}

# Validate parallel builds
validate_parallel_builds() {
    local file="$1"
    local workflow="$2"

    # Check for matrix strategy or multiple jobs
    if yaml_has_pattern "$file" "(matrix:|strategy:.*matrix|needs:)"; then
        pass "$workflow supports parallel builds"
        return 0
    fi

    # Check for multiple build steps (sequential but separate)
    local backend_build=$(grep -c "backend" "$file" || echo "0")
    local worker_build=$(grep -c "worker" "$file" || echo "0")

    if [[ $backend_build -gt 0 && $worker_build -gt 0 ]]; then
        pass "$workflow builds both backend and worker"
        return 0
    fi

    warn "$workflow may not build both services"
    return 0
}

# Validate deployment workflow
validate_deployment() {
    local file="$1"
    local workflow="$2"

    local has_deploy=false
    local has_cloudrun=false

    if yaml_has_pattern "$file" "(deploy|gcloud.*run.*deploy|cloud-run)"; then
        has_deploy=true
    fi

    if yaml_has_pattern "$file" "(run\.googleapis\.com|gcloud.*run|cloud-run|cloudrun)"; then
        has_cloudrun=true
    fi

    if $has_deploy && $has_cloudrun; then
        pass "$workflow deploys to Cloud Run"
        return 0
    elif $has_deploy; then
        warn "$workflow has deployment step but may not target Cloud Run"
        return 0
    else
        info "$workflow is build-only (deployment may be in separate workflow)"
        return 0
    fi
}

# Validate workflow syntax with actionlint if available
validate_with_actionlint() {
    local file="$1"
    local workflow="$2"

    if ! command -v actionlint &> /dev/null; then
        warn "actionlint not available, skipping workflow linting (install with: brew install actionlint)"
        return 0
    fi

    local output
    if output=$(actionlint "$file" 2>&1); then
        pass "$workflow passes actionlint validation"
        return 0
    else
        warn "$workflow has actionlint warnings:"
        echo "$output" | head -10
        return 0  # Warning only
    fi
}

echo "============================================"
echo "GitHub Actions Workflow Validation for Feature #39"
echo "============================================"
echo ""

# Define expected workflow locations
WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"

# Find build and deploy workflows
BUILD_WORKFLOW=""
DEPLOY_WORKFLOW=""

if [[ -d "$WORKFLOWS_DIR" ]]; then
    # Look for build workflow (could also be combined build+deploy)
    for name in "build.yml" "build.yaml" "docker-build.yml" "docker-build.yaml" "ci.yml" "ci.yaml" "deploy.yml" "deploy.yaml"; do
        if [[ -f "$WORKFLOWS_DIR/$name" ]]; then
            BUILD_WORKFLOW="$WORKFLOWS_DIR/$name"
            break
        fi
    done

    # Look for deploy workflow (might be combined with build)
    for name in "deploy.yml" "deploy.yaml" "cd.yml" "cd.yaml" "cloudrun.yml" "cloudrun.yaml"; do
        if [[ -f "$WORKFLOWS_DIR/$name" ]]; then
            DEPLOY_WORKFLOW="$WORKFLOWS_DIR/$name"
            break
        fi
    done

    # If no specific deploy workflow, deployment might be in build workflow
    if [[ -z "$DEPLOY_WORKFLOW" && -n "$BUILD_WORKFLOW" ]]; then
        if yaml_has_pattern "$BUILD_WORKFLOW" "deploy"; then
            DEPLOY_WORKFLOW="$BUILD_WORKFLOW"
        fi
    fi
else
    fail "GitHub workflows directory not found: $WORKFLOWS_DIR"
fi

# --- Build Workflow Validation ---
echo "--- Build Workflow ---"

if [[ -n "$BUILD_WORKFLOW" ]]; then
    info "Found build workflow: $BUILD_WORKFLOW"
    validate_main_trigger "$BUILD_WORKFLOW" "Build workflow"
    validate_gcp_auth "$BUILD_WORKFLOW" "Build workflow"
    validate_docker_build "$BUILD_WORKFLOW" "Build workflow"
    validate_image_tags "$BUILD_WORKFLOW" "Build workflow"
    validate_artifact_registry "$BUILD_WORKFLOW" "Build workflow"
    validate_parallel_builds "$BUILD_WORKFLOW" "Build workflow"
    validate_with_actionlint "$BUILD_WORKFLOW" "Build workflow"
else
    fail "Build workflow not found"
    info "Expected locations: .github/workflows/build.yml, .github/workflows/docker-build.yml"
fi

echo ""

# --- Deploy Workflow Validation ---
echo "--- Deploy Workflow ---"

if [[ -n "$DEPLOY_WORKFLOW" ]]; then
    if [[ "$DEPLOY_WORKFLOW" == "$BUILD_WORKFLOW" ]]; then
        info "Deployment is combined with build workflow"
    else
        info "Found deploy workflow: $DEPLOY_WORKFLOW"
    fi
    validate_deployment "$DEPLOY_WORKFLOW" "Deploy workflow"
else
    warn "Separate deploy workflow not found (may be handled manually or in build workflow)"
fi

echo ""
echo "============================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "============================================"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
