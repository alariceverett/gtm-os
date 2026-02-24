#!/bin/zsh
set -euo pipefail

APP_DIR="/Users/alariceverett/.openclaw/workspace/apps/gtm-command-center"
ROOT_ENV="/Users/alariceverett/.openclaw/workspace/.env"

if [[ -f "$ROOT_ENV" ]]; then
  set -a
  source "$ROOT_ENV"
  set +a
fi

export PORT=1981
# Local operator mode: disable HTTP basic auth unless explicitly overridden in env.
: "${CC_AUTH_ENABLED:=false}"
export CC_AUTH_ENABLED
cd "$APP_DIR"
exec /opt/homebrew/bin/node server.mjs
