#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/dev/multi-device.env"
PID_FILE="$ROOT/dev/.multi-device.pids"
EXPO_LOG="$ROOT/dev/expo-web.log"
NGROK_LOG="$ROOT/dev/ngrok.log"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Copy dev/multi-device.env.example to dev/multi-device.env and set NGROK_DOMAIN."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ -z "${NGROK_DOMAIN:-}" ]]; then
  echo "NGROK_DOMAIN is empty in $ENV_FILE. Set your reserved ngrok hostname, without https://"
  exit 1
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok is not installed or not on PATH."
  echo "Install it, authenticate, then rerun this script."
  exit 1
fi

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null
fi

PUBLIC_ORIGIN="https://${NGROK_DOMAIN}"
export APP_ENV=development
export CORS_ALLOWED_ORIGINS="${PUBLIC_ORIGIN},http://localhost:8081,http://localhost:8090"

cd "$ROOT"
docker compose --profile multi-device up -d --build postgres migrate backend gateway

cd "$ROOT/frontend"
if [[ ! -d node_modules ]]; then
  corepack yarn install
fi

EXPO_PUBLIC_BACKEND_URL="$PUBLIC_ORIGIN" \
  corepack yarn web --port 8081 --host lan >"$EXPO_LOG" 2>&1 &
EXPO_PID=$!

ngrok http 8090 --url "https://${NGROK_DOMAIN}" >"$NGROK_LOG" 2>&1 &
NGROK_PID=$!

cat >"$PID_FILE" <<EOF
EXPO_PID=$EXPO_PID
NGROK_PID=$NGROK_PID
EOF

cat <<EOF

Kerjo multi-device testing stack is starting.

Open on another device:
  $PUBLIC_ORIGIN

Local same-origin check:
  http://localhost:8090

Google OAuth (testing client only):
  Authorized JavaScript origin: $PUBLIC_ORIGIN
  Authorized redirect URI:      $PUBLIC_ORIGIN/

CMS, Postgres, and Metro stay local. Stop everything with:
  ./dev/stop-multi-device.sh

EOF
