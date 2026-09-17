#!/usr/bin/env bash
# Evidence Desk (C08) — build, start, and expose through ngrok.
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-3000}"

# La clé vient de .env.local (Mac) ou d'une variable d'environnement (GitHub Codespaces secret)
if [ ! -f .env.local ] && [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "Missing DeepSeek key → run: cp .env.example .env.local  and paste your DEEPSEEK_API_KEY"
  echo "(in GitHub Codespaces: add DEEPSEEK_API_KEY as a Codespaces secret instead)"
  exit 1
fi
command -v node >/dev/null || { echo "Node.js 20+ is required (https://nodejs.org)"; exit 1; }

[ -d node_modules ] || npm install
npm run build
npx next start -p "$PORT" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 3
echo "Local: http://localhost:$PORT   (German UI; English: http://localhost:$PORT/?lang=en)"

if [ "${CODESPACES:-}" = "true" ]; then
  echo "GitHub Codespaces: open the PORTS tab → right-click port $PORT → Port Visibility → Public, then share that URL."
  if [ -n "${DEMO_PASSWORD:-}" ]; then
    echo "Password protection is ON (user: dail)."
  else
    echo "WARNING: DEMO_PASSWORD is not set — a public port can be used by anyone (and spend your API credit)."
  fi
  wait $SERVER
elif command -v ngrok >/dev/null; then
  echo "Opening the ngrok tunnel — share the https://…ngrok… URL shown below (add ?lang=en for the English version)."
  if [ -n "${DEMO_PASSWORD:-}" ] || grep -qs '^DEMO_PASSWORD=' .env.local; then
    echo "Password protection is ON (user: dail, password: DEMO_PASSWORD from .env.local)."
  fi
  ngrok http "$PORT"
else
  echo "ngrok not found. Install it:  brew install ngrok  then  ngrok config add-authtoken <YOUR_TOKEN>"
  wait $SERVER
fi
