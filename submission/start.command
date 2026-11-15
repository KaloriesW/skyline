#!/bin/zsh
set -eu
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
TASK_DIR="$(cd "$APP_DIR/../.." && pwd)"
if [[ -x "$APP_DIR/.venv/bin/python" ]]; then
  APP_PYTHON="$APP_DIR/.venv/bin/python"
elif [[ -x "$TASK_DIR/work/landslide-venv/bin/python" ]]; then
  APP_PYTHON="$TASK_DIR/work/landslide-venv/bin/python"
else
  echo 'Set up the Python environment using README.md first.'
  exit 1
fi
cd "$APP_DIR"
exec "$APP_PYTHON" -m uvicorn app:app --host 127.0.0.1 --port 8765
