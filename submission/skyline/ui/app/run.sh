#!/usr/bin/env bash
# Start the Skyline app: creates a virtualenv on first run, installs requirements, runs uvicorn.
#   ./run.sh                      http://127.0.0.1:8765
#   PORT=9000 HOST=0.0.0.0 ./run.sh
# HOST and PORT may also be set in .env. SKYLINE_VENV points at a different virtualenv
# (default ui/app/.venv, which .gitignore keeps out of the auto-sync).
set -euo pipefail
cd "$(dirname "$0")"

# HOST/PORT from .env unless already set in the shell (the app itself loads the rest of .env).
if [ -f .env ]; then
  for name in HOST PORT; do
    if [ -z "${!name:-}" ]; then
      value="$(sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}${name}=//p" .env | tail -n 1 | sed "s/[[:space:]]#.*$//; s/^[\"']//; s/[\"'][[:space:]]*$//; s/[[:space:]]*$//")"
      if [ -n "$value" ]; then export "$name=$value"; fi
    fi
  done
fi
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8765}"
VENV="${SKYLINE_VENV:-.venv}"
PYTHON="${PYTHON:-python3}"

if ! "$VENV/bin/python" -m pip --version >/dev/null 2>&1; then
  if [ -e "$VENV" ] || [ -L "$VENV" ]; then
    echo "Skyline environment is incomplete: $VENV. Choose a new SKYLINE_VENV path or repair it manually." >&2
    exit 1
  fi
  "$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else "Skyline needs Python 3.10 or newer (set PYTHON=/path/to/python3.x)")'
  "$PYTHON" -m venv "$VENV"
fi
# Reinstall only when requirements.txt changed since the last successful install.
stamp="$VENV/.skyline-requirements"
if ! cmp -s requirements.txt "$stamp" 2>/dev/null; then
  "$VENV/bin/python" -m pip install --quiet --disable-pip-version-check -r requirements.txt
  cp requirements.txt "$stamp"
fi

# No .pyc files: ui/server and ui/mcp are imported in place and the repo auto-commits.
export PYTHONDONTWRITEBYTECODE=1
echo "Skyline on http://$HOST:$PORT"
# One worker on purpose: spend total, rate limits and caches live in the process.
exec "$VENV/bin/python" -m uvicorn server:app --host "$HOST" --port "$PORT" --workers 1 --proxy-headers
