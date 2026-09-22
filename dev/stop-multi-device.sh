#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/dev/.multi-device.pids"

if [[ -f "$PID_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$PID_FILE"
  if [[ -n "${EXPO_PID:-}" ]] && kill -0 "$EXPO_PID" 2>/dev/null; then
    kill "$EXPO_PID" 2>/dev/null || true
  fi
  if [[ -n "${NGROK_PID:-}" ]] && kill -0 "$NGROK_PID" 2>/dev/null; then
    kill "$NGROK_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

pkill -f "ngrok http --domain=" 2>/dev/null || true
pkill -f "ngrok http 8090 --url" 2>/dev/null || true
pkill -f "expo start --web --port 8081" 2>/dev/null || true
pkill -f "yarn web --port 8081" 2>/dev/null || true

cd "$ROOT"
docker compose --profile multi-device stop postgres backend gateway

echo "Stopped the testing-only multi-device stack. Local Docker volumes were kept."
