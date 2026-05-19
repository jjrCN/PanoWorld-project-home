#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No running panorama tour service found."
  exit 0
fi

SERVER_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
  kill "$SERVER_PID"
  echo "Stopped panorama tour service (PID $SERVER_PID)."
else
  echo "Stored PID is not active. Cleaning up stale PID file."
fi

rm -f "$PID_FILE"
