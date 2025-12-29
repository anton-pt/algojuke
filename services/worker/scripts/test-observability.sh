#!/bin/bash

#
# Test Script: Dashboard Observability Validation (US2)
#
# Purpose: Automated script to validate Inngest dashboard observability features
# Usage: ./scripts/test-observability.sh
#
# This script sends 5 demo tasks with varied configurations to validate:
# - Successful task execution visibility
# - Failed task error inspection
# - Priority queue ordering
# - Dashboard filtering and navigation
#

set -e

echo "=================================="
echo "Observability Dashboard Test Suite"
echo "=================================="
echo ""

INNGEST_URL="${INNGEST_URL:-http://localhost:8288}"
WORKER_URL="${WORKER_URL:-http://localhost:3001}"

echo "Configuration:"
echo "  Inngest URL: $INNGEST_URL"
echo "  Worker URL: $WORKER_URL"
echo ""

# Check services are running
echo "Checking services..."
if ! curl -s "$WORKER_URL/health" > /dev/null; then
  echo "❌ Worker service not reachable at $WORKER_URL"
  echo "   Please ensure: npm run dev is running in services/worker/"
  exit 1
fi

if ! curl -s "$INNGEST_URL/health" > /dev/null 2>&1; then
  echo "❌ Inngest Dev Server not reachable at $INNGEST_URL"
  echo "   Please ensure: docker-compose up inngest is running"
  exit 1
fi

echo "✅ Services are running"
echo ""

echo "Sending 5 demo tasks with varied configurations..."
echo ""

# Task 1: Successful execution
echo "1. Sending successful task..."
TASK_1_ID="obs-test-$(date +%s)-success"
curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo/task.requested\",
    \"data\": {
      \"taskId\": \"$TASK_1_ID\",
      \"simulateFailure\": false,
      \"delayMs\": 500
    }
  }" | jq -r '.ids[0]' || echo "Manual submission via Inngest UI required"

echo "   Task ID: $TASK_1_ID"
echo "   Expected: Completed status with all 5 steps"
echo ""
sleep 2

# Task 2: Failure at step-2
echo "2. Sending task with failure at step-2-process..."
TASK_2_ID="obs-test-$(date +%s)-fail-step2"
curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo/task.requested\",
    \"data\": {
      \"taskId\": \"$TASK_2_ID\",
      \"simulateFailure\": true,
      \"failAtStep\": \"step-2-process\"
    }
  }" | jq -r '.ids[0]' || echo "Manual submission via Inngest UI required"

echo "   Task ID: $TASK_2_ID"
echo "   Expected: Failed status with error at step 2"
echo ""
sleep 2

# Task 3: Failure at step-4
echo "3. Sending task with failure at step-4-simulate-api-call..."
TASK_3_ID="obs-test-$(date +%s)-fail-step4"
curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo/task.requested\",
    \"data\": {
      \"taskId\": \"$TASK_3_ID\",
      \"simulateFailure\": true,
      \"failAtStep\": \"step-4-simulate-api-call\"
    }
  }" | jq -r '.ids[0]' || echo "Manual submission via Inngest UI required"

echo "   Task ID: $TASK_3_ID"
echo "   Expected: Failed status with error at step 4"
echo ""
sleep 2

# Task 4: High priority
echo "4. Sending high priority task..."
TASK_4_ID="obs-test-$(date +%s)-high-priority"
curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo/task.requested\",
    \"data\": {
      \"taskId\": \"$TASK_4_ID\",
      \"priority\": 300,
      \"simulateFailure\": false
    }
  }" | jq -r '.ids[0]' || echo "Manual submission via Inngest UI required"

echo "   Task ID: $TASK_4_ID"
echo "   Expected: Executes before normal priority tasks"
echo ""
sleep 2

# Task 5: Low priority
echo "5. Sending low priority task..."
TASK_5_ID="obs-test-$(date +%s)-low-priority"
curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"demo/task.requested\",
    \"data\": {
      \"taskId\": \"$TASK_5_ID\",
      \"priority\": -300,
      \"simulateFailure\": false
    }
  }" | jq -r '.ids[0]' || echo "Manual submission via Inngest UI required"

echo "   Task ID: $TASK_5_ID"
echo "   Expected: Executes after normal priority tasks"
echo ""

echo "=================================="
echo "Test tasks submitted successfully!"
echo "=================================="
echo ""
echo "Manual Validation Checklist:"
echo ""
echo "1. Open Inngest Dashboard: $INNGEST_URL"
echo "2. Navigate to Functions → demo-task"
echo "3. Verify 5 function runs appear"
echo "4. Execution order should be: Task 4 (high) → Task 1 (normal) → Task 5 (low)"
echo "5. Click on failed run (Task 2 or 3):"
echo "   - Error message visible"
echo "   - Failed step highlighted"
echo "   - Retry attempts shown in waterfall"
echo "6. Click on successful run (Task 1, 4, or 5):"
echo "   - All step outputs visible"
echo "   - Waterfall trace complete"
echo "   - Total duration displayed"
echo "7. Test manual retry:"
echo "   - Click 'Replay' button on failed task"
echo "   - Verify task re-executes with same payload"
echo ""
echo "Dashboard URL: $INNGEST_URL/functions/demo-task"
echo ""
