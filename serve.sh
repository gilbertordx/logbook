#!/usr/bin/env bash
# serve.sh — Local dev server for LOGBOOK
# ES Modules require HTTP (file:// blocks cross-origin imports in most browsers).

set -e

PORT="${1:-8080}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════╗"
echo "║  LOGBOOK — Dev Server                ║"
echo "╠══════════════════════════════════════╣"
echo "║  URL  : http://localhost:${PORT}        ║"
echo "║  Root : ${DIR}"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Press Ctrl-C to stop."
echo ""

cd "$DIR"

# Use Python 3 if available, else Python 2
if command -v python3 &>/dev/null; then
  python3 -m http.server "$PORT"
elif command -v python &>/dev/null; then
  python -m SimpleHTTPServer "$PORT"
else
  echo "[ERROR] Python not found. Install Python 3 to use this server."
  exit 1
fi
