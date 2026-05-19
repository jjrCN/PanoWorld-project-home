#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/server.pid"
PORT="${PORT:-8002}"

if [[ -f "$PID_FILE" ]]; then
  SERVER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    CURRENT_IP="$(hostname -I | awk '{print $1}')"
    echo "RUNNING"
    echo "PID: ${SERVER_PID}"
    echo "URL: http://${CURRENT_IP}:${PORT}/"
    exit 0
  fi
fi

echo "STOPPED"
exit 1
