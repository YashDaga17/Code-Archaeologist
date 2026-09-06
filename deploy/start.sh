#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CODE ARCHAEOLOGIST — Databricks Apps Startup Orchestrator
# ═══════════════════════════════════════════════════════════════
# This script is invoked by Databricks Apps runtime via app.yaml
# It coordinates:
#   1. Internal Backend API (Express + Databricks AI + Delta Lake) on loopback
#   2. External Next.js Frontend bound to $DATABRICKS_APP_PORT (0.0.0.0)
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║                                                            ║"
echo "  ║   ⛏  CODE ARCHAEOLOGIST — DATABRICKS APPS RUNTIME           ║"
echo "  ║   Checkpoint-Native Developer Intelligence                 ║"
echo "  ║                                                            ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo ""

# Databricks Apps sets DATABRICKS_APP_PORT (defaults to 8000 in local/dev container)
export APP_PORT="${DATABRICKS_APP_PORT:-8000}"
export BACKEND_PORT="${BACKEND_PORT:-3001}"
export NODE_ENV="${NODE_ENV:-production}"

echo "➤ Node version: $(node -v)"
echo "➤ Target Ingress Port (\$DATABRICKS_APP_PORT): ${APP_PORT}"
echo "➤ Internal Backend Port (\$BACKEND_PORT):      ${BACKEND_PORT}"
if [ -n "${DATABRICKS_HOST:-}" ]; then
  echo "➤ Databricks Host:                           configured"
else
  echo "➤ Databricks Host:                           using backend/.env fallback"
fi

# 1. Ensure Dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "➤ Installing frontend dependencies..."
  npm install --omit=dev --no-audit --no-fund
fi

if [ ! -d "backend/node_modules" ]; then
  echo "➤ Installing backend dependencies..."
  (cd backend && npm install --omit=dev --no-audit --no-fund)
fi

# 2. Ensure Next.js production build exists
if [ ! -d ".next" ]; then
  echo "➤ Compiling Next.js production build..."
  npx next build
fi

# 3. Clean up child processes on exit/signal
cleanup() {
  echo ""
  echo "➤ Caught shutdown signal. Stopping child services gracefully..."
  if [ -n "$BACKEND_PID" ]; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo "➤ All processes stopped. Goodbye!"
  exit 0
}

trap cleanup SIGTERM SIGINT EXIT

# 4. Boot Internal Backend Service in Background
echo "➤ Starting Code Archaeologist Backend API on port ${BACKEND_PORT}..."
node backend/index.js &
BACKEND_PID=$!

# 5. Wait for Backend Health Check to pass
echo "➤ Awaiting backend health check on http://127.0.0.1:${BACKEND_PORT}/api/health..."
MAX_RETRIES=30
RETRY_COUNT=0
HEALTHY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

if [ $HEALTHY -eq 1 ]; then
  echo "✓ Backend API is healthy and operational!"
else
  echo "⚠ Warning: Backend health check timed out after ${MAX_RETRIES}s. Starting frontend anyway..."
fi

# 6. Boot Next.js Frontend bound to Databricks App Port on 0.0.0.0
echo "➤ Launching Next.js Production Server on 0.0.0.0:${APP_PORT}..."
./node_modules/.bin/next start -p "${APP_PORT}" -H 0.0.0.0 &
FRONTEND_PID=$!

echo ""
echo "  ✓ CODE ARCHAEOLOGIST is now LIVE on Databricks Apps!"
echo "  ✓ Ingress URL: http://0.0.0.0:${APP_PORT}"
echo ""

# 7. Wait on frontend process
wait "$FRONTEND_PID"
