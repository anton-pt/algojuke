#!/bin/bash

#
# Test Script: Rate Limiting Validation (US3)
#
# Purpose: Automated script to validate Inngest throttle configuration
# Usage: ./scripts/test-rate-limits.sh
#
# This script sends 200 demo tasks rapidly to validate:
# - Throttle limit of 20 executions per 60 seconds (global)
# - Concurrency limit of 10 simultaneous executions
# - Queue behavior when limits exceeded
# - Dashboard visibility of throttled tasks
#

set -e

echo "================================"
echo "Rate Limiting Validation Suite"
echo "================================"
echo ""

INNGEST_URL="${INNGEST_URL:-http://localhost:8288}"
WORKER_URL="${WORKER_URL:-http://localhost:3001}"

echo "Configuration:"
echo "  Inngest URL: $INNGEST_URL"
echo "  Worker URL: $WORKER_URL"
echo "  Throttle Limit: 20 executions per 60 seconds (global)"
echo "  Concurrency Limit: 10 simultaneous executions"
echo "  Test Tasks: 200"
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

echo "Sending 200 demo tasks rapidly to test throttle behavior..."
echo ""

BATCH_START=$(date +%s)

for i in {1..200}; do
  TASK_ID="rate-limit-test-${BATCH_START}-${i}"

  curl -s -X POST "$INNGEST_URL/e/algojuke-worker" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"demo/task.requested\",
      \"data\": {
        \"taskId\": \"$TASK_ID\",
        \"simulateFailure\": false,
        \"delayMs\": 100
      }
    }" > /dev/null &

  # Print progress
  echo -n "."

  # Small delay between submissions to avoid overwhelming the system
  sleep 0.05
done

# Wait for all background curl processes to complete
wait

echo ""
echo ""
echo "===================================="
echo "200 tasks submitted successfully!"
echo "===================================="
echo ""
echo "Manual Validation Checklist:"
echo ""
echo "1. Open Inngest Dashboard: $INNGEST_URL"
echo "2. Navigate to Functions → demo-task"
echo "3. Observe execution behavior:"
echo "   - All 200 events should be received"
echo "   - Approximately 10 tasks execute concurrently (concurrency limit)"
echo "   - Maximum 20 tasks start per 60s window (throttle limit)"
echo "   - Remaining tasks queued until next time window"
echo "   - Full completion takes ~10 minutes (200 tasks / 20 per minute)"
echo "4. Verify throttle enforcement:"
echo "   - Check 'Throttled' or 'Queued' status in dashboard"
echo "   - Execution rate should not exceed 20 starts per 60s window"
echo "   - Observe time gaps between batches of 20 task starts"
echo ""
echo "Dashboard URL: $INNGEST_URL/functions/demo-task"
echo ""
echo "Expected Behavior Summary:"
echo "  - Concurrency: Max 10 tasks executing simultaneously"
echo "  - Throttle: Max 20 tasks start per 60s window (global)"
echo "  - For 200 tasks: Takes ~10 minutes to complete all"
echo "  - Tasks beyond 20/min are queued to next time window"
echo "  - Dashboard shows throttled/queued status with wait times"
echo ""
