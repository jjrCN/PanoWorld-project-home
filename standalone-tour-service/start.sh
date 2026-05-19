#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$ROOT_DIR/site"
PID_FILE="$ROOT_DIR/server.pid"
LOG_FILE="$ROOT_DIR/server.log"
PORT="${PORT:-8001}"
HOST="${HOST:-0.0.0.0}"

if [[ ! -d "$SITE_DIR" ]]; then
  echo "Site directory not found: $SITE_DIR" >&2
  exit 1
fi

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${OLD_PID:-}" ]] && kill -0 "$OLD_PID" 2>/dev/null; then
    CURRENT_IP="$(hostname -I | awk '{print $1}')"
    echo "PanoWorld panorama tour is already running."
    echo "URL: http://${CURRENT_IP}:${PORT}/"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  OCCUPIED="$(lsof -ti TCP:"$PORT" -sTCP:LISTEN || true)"
  if [[ -n "${OCCUPIED:-}" ]]; then
    echo "Port $PORT is already in use by: $OCCUPIED" >&2
    echo "Please free the port or set PORT=<new-port> before starting." >&2
    exit 1
  fi
fi

nohup python3 -m http.server "$PORT" --bind "$HOST" --directory "$SITE_DIR" >"$LOG_FILE" 2>&1 &
SERVER_PID="$!"
echo "$SERVER_PID" >"$PID_FILE"

sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Failed to start the panorama tour service." >&2
  tail -n 50 "$LOG_FILE" >&2 || true
  exit 1
fi

CURRENT_IP="$(hostname -I | awk '{print $1}')"
echo "PanoWorld panorama tour started successfully."
echo "URL: http://${CURRENT_IP}:${PORT}/"
echo "PID: ${SERVER_PID}"
echo "Log: ${LOG_FILE}"
