#!/usr/bin/env bash
#
# Validates Cloud Run service YAML configurations.
# Tests acceptance criteria from spec 039-docker-cloud-run.
#
# Usage: ./validate-cloudrun.sh
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

# Parse YAML value (basic - works for simple key: value patterns)
yaml_value() {
    local file="$1"
    local key="$2"
    grep -E "^\s*$key:" "$file" | head -1 | sed 's/.*:\s*//' | tr -d '"' | tr -d "'"
}

# Check YAML contains a key
yaml_has_key() {
    local file="$1"
    local key="$2"
    grep -qE "^\s*$key:" "$file"
}

# Check YAML contains a value pattern
yaml_has_pattern() {
    local file="$1"
    local pattern="$2"
    grep -qE "$pattern" "$file"
}

# Validate basic YAML syntax
validate_yaml_syntax() {
    local file="$1"
    local service="$2"

    # Check for common YAML syntax issues
    if grep -qE '^\t' "$file"; then
        fail "$service YAML uses tabs (should use spaces)"
        return 1
    fi

    # Check it starts with valid YAML (apiVersion or similar)
    if head -5 "$file" | grep -qE '^(apiVersion|kind|metadata|spec):'; then
        pass "$service YAML has valid structure"
        return 0
    else
        fail "$service YAML missing standard Cloud Run structure"
        return 1
    fi
}

# Validate Cloud Run API version
validate_api_version() {
    local file="$1"
    local service="$2"

    if yaml_has_pattern "$file" "apiVersion:.*serving.knative.dev/v1|apiVersion:.*run.googleapis.com/v2"; then
        pass "$service uses valid Cloud Run API version"
        return 0
    else
        fail "$service should use Cloud Run v2 or Knative serving API"
        return 1
    fi
}

# Validate service metadata
validate_metadata() {
    local file="$1"
    local service="$2"
    local expected_name="$3"

    if yaml_has_key "$file" "name"; then
        local name=$(yaml_value "$file" "name")
        if [[ -n "$name" ]]; then
            pass "$service has service name configured: $name"
            return 0
        fi
    fi

    fail "$service missing service name in metadata"
    return 1
}

# Validate container port
validate_container_port() {
    local file="$1"
    local service="$2"
    local expected_port="$3"

    if yaml_has_pattern "$file" "containerPort:.*$expected_port"; then
        pass "$service configured for port $expected_port"
        return 0
    else
        fail "$service should expose containerPort $expected_port"
        return 1
    fi
}

# Validate resource limits
validate_resources() {
    local file="$1"
    local service="$2"

    local has_cpu=false
    local has_memory=false

    if yaml_has_pattern "$file" "(cpu:|cpus:)"; then
        has_cpu=true
    fi

    if yaml_has_pattern "$file" "memory:"; then
        has_memory=true
    fi

    if $has_cpu && $has_memory; then
        pass "$service has CPU and memory limits configured"
        return 0
    elif $has_cpu || $has_memory; then
        warn "$service has partial resource configuration"
        return 0
    else
        fail "$service missing resource limits (cpu, memory)"
        return 1
    fi
}

# Validate scaling configuration
validate_scaling() {
    local file="$1"
    local service="$2"

    local has_min=false
    local has_max=false

    if yaml_has_pattern "$file" "(minScale|min-instances|minInstanceCount):"; then
        has_min=true
    fi

    if yaml_has_pattern "$file" "(maxScale|max-instances|maxInstanceCount):"; then
        has_max=true
    fi

    if $has_min && $has_max; then
        pass "$service has scaling limits configured"
        return 0
    elif $has_min || $has_max; then
        warn "$service has partial scaling configuration"
        return 0
    else
        warn "$service missing explicit scaling configuration (using defaults)"
        return 0
    fi
}

# Validate health check / startup probe
validate_health_probe() {
    local file="$1"
    local service="$2"

    if yaml_has_pattern "$file" "(startupProbe|livenessProbe|readinessProbe|httpGet.*health)"; then
        pass "$service has health probe configured"
        return 0
    else
        fail "$service missing health probe configuration"
        return 1
    fi
}

# Validate concurrency settings
validate_concurrency() {
    local file="$1"
    local service="$2"

    if yaml_has_pattern "$file" "(containerConcurrency|concurrency|maxRequestsPerContainer):"; then
        pass "$service has concurrency limit configured"
        return 0
    else
        warn "$service using default concurrency (consider setting explicit limit)"
        return 0
    fi
}

# Validate Secret Manager integration
validate_secrets() {
    local file="$1"
    local service="$2"

    if yaml_has_pattern "$file" "(secretKeyRef|valueFrom.*secretName|secretmanager)"; then
        pass "$service uses Secret Manager for environment variables"
        return 0
    else
        warn "$service may not use Secret Manager for secrets (check env configuration)"
        return 0
    fi
}

echo "============================================"
echo "Cloud Run YAML Validation for Feature #39"
echo "============================================"
echo ""

# Define expected Cloud Run config locations
# These could be in deploy/ directory or similar
DEPLOY_DIR="$PROJECT_ROOT/deploy"
CLOUDRUN_DIR="$DEPLOY_DIR/cloudrun"

# Try multiple possible locations
BACKEND_YAML=""
WORKER_YAML=""

# Check common locations for Cloud Run configs
for dir in "$CLOUDRUN_DIR" "$DEPLOY_DIR" "$PROJECT_ROOT"; do
    for name in "backend.yaml" "service-backend.yaml" "algojuke-backend.yaml" "backend-service.yaml"; do
        if [[ -f "$dir/$name" ]]; then
            BACKEND_YAML="$dir/$name"
            break 2
        fi
    done
done

for dir in "$CLOUDRUN_DIR" "$DEPLOY_DIR" "$PROJECT_ROOT"; do
    for name in "worker.yaml" "service-worker.yaml" "algojuke-worker.yaml" "worker-service.yaml"; do
        if [[ -f "$dir/$name" ]]; then
            WORKER_YAML="$dir/$name"
            break 2
        fi
    done
done

# --- Backend Cloud Run Config Validation ---
echo "--- Backend Service Cloud Run Config ---"

if [[ -n "$BACKEND_YAML" ]]; then
    info "Found backend config: $BACKEND_YAML"
    validate_yaml_syntax "$BACKEND_YAML" "Backend"
    validate_api_version "$BACKEND_YAML" "Backend"
    validate_metadata "$BACKEND_YAML" "Backend" "algojuke-backend"
    validate_container_port "$BACKEND_YAML" "Backend" "4000"
    validate_resources "$BACKEND_YAML" "Backend"
    validate_scaling "$BACKEND_YAML" "Backend"
    validate_health_probe "$BACKEND_YAML" "Backend"
    validate_concurrency "$BACKEND_YAML" "Backend"
    validate_secrets "$BACKEND_YAML" "Backend"
else
    fail "Backend Cloud Run config not found"
    info "Expected locations: deploy/cloudrun/backend.yaml, deploy/backend.yaml"
fi

echo ""

# --- Worker Cloud Run Config Validation ---
echo "--- Worker Service Cloud Run Config ---"

if [[ -n "$WORKER_YAML" ]]; then
    info "Found worker config: $WORKER_YAML"
    validate_yaml_syntax "$WORKER_YAML" "Worker"
    validate_api_version "$WORKER_YAML" "Worker"
    validate_metadata "$WORKER_YAML" "Worker" "algojuke-worker"
    validate_container_port "$WORKER_YAML" "Worker" "3001"
    validate_resources "$WORKER_YAML" "Worker"
    validate_scaling "$WORKER_YAML" "Worker"
    validate_health_probe "$WORKER_YAML" "Worker"
    validate_concurrency "$WORKER_YAML" "Worker"
    validate_secrets "$WORKER_YAML" "Worker"
else
    fail "Worker Cloud Run config not found"
    info "Expected locations: deploy/cloudrun/worker.yaml, deploy/worker.yaml"
fi

echo ""
echo "============================================"
echo "Summary: $PASSED passed, $FAILED failed"
echo "============================================"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
