#!/bin/bash
# Start Skyline on the box's public port 8000 (https://veritas.premiersalesri.com).
# This stops the starter app first, since only port 8000 is public.
pkill -u kids -f 'uvicorn main:app' 2>/dev/null
pkill -u kids -f 'uvicorn server:app' 2>/dev/null
sleep 1
cd "$(dirname "$0")/backend" || exit 1
setsid nohup /home/kids/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 >> ../skyline.log 2>&1 < /dev/null &
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null localhost:8000/api/model; then
    echo "Skyline running on port 8000 -> https://veritas.premiersalesri.com"
    exit 0
  fi
  sleep 1
done
echo "Skyline isn't answering. Last lines of skyline.log:"
tail -n 20 ../skyline.log
exit 1
