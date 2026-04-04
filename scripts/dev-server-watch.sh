#!/bin/bash
# Auto-restart dev server when it dies
# Usage: nohup bash scripts/dev-server-watch.sh &

export COREPACK_HOME="$HOME/.corepack"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

while true; do
  echo "[dev-watch] Starting dev server at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  pnpm dev 2>&1 | tee /tmp/dev-server.log
  EXIT_CODE=$?
  echo "[dev-watch] Dev server exited with code $EXIT_CODE at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[dev-watch] Restarting in 5 seconds..."
  sleep 5
done
