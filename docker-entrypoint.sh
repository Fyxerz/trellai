#!/bin/sh
set -e

echo "[trellai] Starting Socket.IO sidecar on port ${SOCKET_PORT:-3001}..."
node orchestrator/server.js &

echo "[trellai] Starting Next.js server on port 3000..."
exec node server.js
