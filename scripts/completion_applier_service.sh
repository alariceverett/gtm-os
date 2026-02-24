#!/usr/bin/env bash
set -euo pipefail

LABEL="local.openclaw.completion-applier"
WORKSPACE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_TEMPLATE="$WORKSPACE/org/launchd/$LABEL.plist"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"
STATUS_JSON="$WORKSPACE/ops/completion_applier_status.json"
OUT_LOG="$WORKSPACE/memory/completion_applier/launchd.out.log"
ERR_LOG="$WORKSPACE/memory/completion_applier/launchd.err.log"
TARGET="gui/$(id -u)"

usage() {
  cat <<EOF
Usage: scripts/completion_applier_service.sh <command>

Commands:
  install    Install/refresh launchd plist
  start      Install (if needed), load service, and kickstart
  stop       Stop/unload service
  restart    Restart service
  status     Show launchd + applier status
  logs       Tail service logs
  uninstall  Stop service and remove launchd plist
EOF
}

ensure_dirs() {
  mkdir -p "$WORKSPACE/memory/completion_applier" "$PLIST_DIR"
}

render_plist() {
  sed "s#__WORKSPACE__#$WORKSPACE#g" "$PLIST_TEMPLATE"
}

install_plist() {
  ensure_dirs
  local tmp
  tmp="$(mktemp)"
  render_plist > "$tmp"

  if [[ -f "$PLIST_PATH" ]] && cmp -s "$tmp" "$PLIST_PATH"; then
    rm -f "$tmp"
    echo "plist already up to date: $PLIST_PATH"
    return 0
  fi

  mv "$tmp" "$PLIST_PATH"
  echo "installed plist: $PLIST_PATH"
}

is_loaded() {
  launchctl print "$TARGET/$LABEL" >/dev/null 2>&1
}

do_start() {
  install_plist
  if is_loaded; then
    echo "service already loaded; kickstarting"
  else
    launchctl bootstrap "$TARGET" "$PLIST_PATH"
    echo "service bootstrapped"
  fi
  launchctl kickstart -k "$TARGET/$LABEL"
  echo "service started: $LABEL"
}

do_stop() {
  if is_loaded; then
    launchctl bootout "$TARGET/$LABEL"
    echo "service stopped: $LABEL"
  elif [[ -f "$PLIST_PATH" ]]; then
    launchctl bootout "$TARGET" "$PLIST_PATH" >/dev/null 2>&1 || true
    echo "service not loaded; ensured bootout"
  else
    echo "service not installed"
  fi
}

do_status() {
  echo "== launchd =="
  if is_loaded; then
    launchctl print "$TARGET/$LABEL" | grep -E "state =|pid =|last exit code =" || true
  else
    echo "not loaded: $LABEL"
  fi

  echo
  echo "== completion applier status json =="
  if [[ -f "$STATUS_JSON" ]]; then
    cat "$STATUS_JSON"
  else
    echo "missing: $STATUS_JSON"
  fi

  echo
  echo "== logs =="
  [[ -f "$OUT_LOG" ]] && echo "stdout: $OUT_LOG" || echo "stdout log missing"
  [[ -f "$ERR_LOG" ]] && echo "stderr: $ERR_LOG" || echo "stderr log missing"
}

do_logs() {
  ensure_dirs
  touch "$OUT_LOG" "$ERR_LOG"
  tail -n 80 -f "$OUT_LOG" "$ERR_LOG"
}

do_uninstall() {
  do_stop || true
  rm -f "$PLIST_PATH"
  echo "removed plist: $PLIST_PATH"
}

cmd="${1:-}"
case "$cmd" in
  install) install_plist ;;
  start) do_start ;;
  stop) do_stop ;;
  restart) do_stop; do_start ;;
  status) do_status ;;
  logs) do_logs ;;
  uninstall) do_uninstall ;;
  *) usage; exit 1 ;;
esac
