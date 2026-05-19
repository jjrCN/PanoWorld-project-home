#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$ROOT_DIR/start.sh"
sleep 1
xdg-open "http://10.35.28.39:8002/" >/dev/null 2>&1 &
