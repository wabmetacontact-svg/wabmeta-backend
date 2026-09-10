#!/usr/bin/env bash
# Run the backend against the LOCAL Docker Postgres, without touching the
# production .env. dotenv.config() does not override existing env vars, so these
# exports win over the .env values.
#
#   bash dev-local.sh                         # start backend on :10000 (local DB)
#   bash dev-local.sh https://xxxx.ngrok.app  # also register Telegram webhooks at this base URL
set -euo pipefail

export DATABASE_URL="postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_dev"
export DIRECT_URL="$DATABASE_URL"

if [ "${1:-}" != "" ]; then
  export TELEGRAM_WEBHOOK_BASE_URL="$1"
  echo "Telegram webhook base URL: $TELEGRAM_WEBHOOK_BASE_URL"
fi

echo "Backend -> LOCAL db (localhost:5433/wabmeta_dev) on port ${PORT:-10000}"
exec npm run dev
