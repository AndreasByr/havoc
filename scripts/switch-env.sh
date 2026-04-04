#!/bin/bash
# Switch between local and tunnel .env
# Usage: bash scripts/switch-env.sh local|tunnel

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

MODE="${1:-local}"

if [ "$MODE" = "local" ]; then
  cp .env.local .env
  echo "✅ Switched to LOCAL mode (localhost:3000/3003)"
  echo "   → SSH Port Forwarding / direkte Verbindung"
elif [ "$MODE" = "tunnel" ]; then
  cp .env.tunnel .env
  echo "✅ Switched to TUNNEL mode (guildora-*.myweby.org)"
  echo "   → Cloudflare Tunnel"
else
  echo "Usage: $0 local|tunnel"
  exit 1
fi

echo ""
echo "Dev Server neu starten damit die Änderungen greifen!"
