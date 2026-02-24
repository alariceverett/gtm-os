#!/usr/bin/env python3
"""Autonomous completion applier daemon.

Detects newly completed subagent runs and safely applies validated changes
into the live workspace branch by creating guarded commits.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ORG = ROOT / "org"
OPS = ROOT / "ops"
MEMORY = ROOT / "memory" / "completion_applier"
CONFIG_FILE = ORG / "completion_applier.config.json"
STATE_FILE = MEMORY / "state.json"
LOCK_FILE = MEMORY / "daemon.lock"
STATUS_JSON = OPS / "completion_applier_status.json"
STATUS_MD = OPS / "completion_applier_status.md"
INCIDENTS_JSONL = OPS / "completion_applier_incidents.jsonl"


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat()


def sh(cmd: list[str], timeout: int = 30) -> tuple[int, str, str]:
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def ensure_dirs() -> None:
    MEMORY.mkdir(parents=True, exist_ok=True)
    OPS.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def append_incident(kind: str, run_key: str, detail: str, remediation: str = "skipped") -> None:
    rec = {
        "ts": now_iso(),
        "kind": kind,
        "run_key": run_key,
        "detail": detail,
        "remediation": remediation,
    }
    with INCIDENTS_JSONL.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, sort_keys=True) + "\n")


def acquire_lock(stale_seconds: int) -> bool:
    now = int(time.time())
    if LOCK_FILE.exists():
        try:
            lock = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
            ts = int(lock.get("ts", 0))
            pid = int(lock.get("pid", -1))
            if now - ts < stale_seconds:
                os.kill(pid, 0)
                return False
        except Exception:
            pass
        LOCK_FILE.unlink(missing_ok=True)
    LOCK_FILE.write_text(json.dumps({"pid": os.getpid(), "ts": now}), encoding="utf-8")
    return True


def release_lock() -> None:
    LOCK_FILE.unlink(missing_ok=True)


def active_subagent_keys(active_minutes: int) -> set[str]:
    code, out, _err = sh(["openclaw", "sessions", "--active", str(active_minutes), "--json"], timeout=20)
    if code != 0:
        return set()
    try:
        sessions = json.loads(out).get("sessions", [])
    except Exception:
        return set()
    return {
        str(s.get("key", ""))
        for s in sessions
        if str(s.get("key", "")).startswith("agent:main:subagent:")
    }


def has_conflicts() -> tuple[bool, str]:
    code, out, err = sh(["git", "ls-files", "-u"], timeout=20)
    if code != 0:
        return True, err or "git ls-files -u failed"
    if out.strip():
        return True, "unmerged paths present"
    return False, ""


def changed_files() -> list[str]:
    code, out, _err = sh(["git", "status", "--porcelain"], timeout=20)
    if code != 0 or not out.strip():
        return []
    files: list[str] = []
    for line in out.splitlines():
        if len(line) >= 4:
            files.append(line[3:])
    return files


def git_branch() -> str:
    code, out, _err = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"], timeout=15)
    return out if code == 0 else "unknown"


def validate_workspace(cmd: str | None) -> tuple[bool, str]:
    if not cmd:
        return True, "validation skipped (no command configured)"
    proc = subprocess.run(cmd, shell=True, cwd=str(ROOT), capture_output=True, text=True)
    if proc.returncode != 0:
        return False, (proc.stderr or proc.stdout or "validation failed")[:1200]
    return True, (proc.stdout or "ok")[:1200]


def safe_apply_for_run(run_key: str, cfg: dict[str, Any]) -> dict[str, Any]:
    conflict, reason = has_conflicts()
    if conflict:
        append_incident("merge_conflict", run_key, reason)
        return {"ok": False, "run_key": run_key, "status": "skipped_conflict", "detail": reason}

    files = changed_files()
    if not files:
        return {"ok": True, "run_key": run_key, "status": "noop", "files": [], "commit": None}

    ok, msg = validate_workspace(cfg.get("validation_command"))
    if not ok:
        append_incident("validation_failed", run_key, msg)
        return {"ok": False, "run_key": run_key, "status": "skipped_validation", "detail": msg}

    code, _out, err = sh(["git", "add", "-A"], timeout=30)
    if code != 0:
        append_incident("git_add_failed", run_key, err or "git add failed")
        return {"ok": False, "run_key": run_key, "status": "skipped_add_failed", "detail": err}

    code, out, _err = sh(["git", "diff", "--cached", "--name-only"], timeout=20)
    staged = [l.strip() for l in out.splitlines() if l.strip()] if code == 0 else []
    if not staged:
        return {"ok": True, "run_key": run_key, "status": "noop", "files": [], "commit": None}

    message = f"chore(applier): apply completed run {run_key.split(':')[-1]}"
    code, out, err = sh(["git", "commit", "-m", message], timeout=40)
    if code != 0:
        append_incident("git_commit_failed", run_key, err or out or "git commit failed")
        return {"ok": False, "run_key": run_key, "status": "skipped_commit_failed", "detail": err or out}

    ccode, commit_sha, _cerr = sh(["git", "rev-parse", "HEAD"], timeout=10)
    return {
        "ok": True,
        "run_key": run_key,
        "status": "applied",
        "files": staged,
        "commit": commit_sha if ccode == 0 else None,
        "branch": git_branch(),
        "validation": msg,
    }


def write_status(state: dict[str, Any], cycle: dict[str, Any]) -> None:
    payload = {
        "ts": now_iso(),
        "last_applied_run": state.get("last_applied_run"),
        "last_applied_commit": state.get("last_applied_commit"),
        "pending_applies": state.get("pending", []),
        "pending_count": len(state.get("pending", [])),
        "failures": state.get("failures", [])[-20:],
        "last_cycle": cycle,
    }
    save_json(STATUS_JSON, payload)

    lines = [
        "# Completion Applier Status",
        f"- Updated: {payload['ts']}",
        f"- Last applied run: {payload['last_applied_run'] or 'none'}",
        f"- Last applied commit: {payload['last_applied_commit'] or 'none'}",
        f"- Pending applies: {payload['pending_count']}",
        f"- Recent failures: {len(payload['failures'])}",
        "",
        "## Pending",
    ]
    if payload["pending_applies"]:
        for rk in payload["pending_applies"]:
            lines.append(f"- {rk}")
    else:
        lines.append("- none")

    lines.append("")
    lines.append("## Recent failures")
    if payload["failures"]:
        for f in payload["failures"][-10:]:
            lines.append(f"- {f.get('ts')}: {f.get('run_key')} -> {f.get('status')}")
    else:
        lines.append("- none")

    STATUS_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def tick(cfg: dict[str, Any], state: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    prev_active = set(state.get("active_keys", []))
    current_active = active_subagent_keys(int(cfg["active_window_minutes"]))
    newly_completed = sorted(prev_active - current_active)

    pending = list(state.get("pending", []))
    for rk in newly_completed:
        if rk not in pending and rk not in state.get("processed", {}):
            pending.append(rk)

    applied: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    processed = dict(state.get("processed", {}))

    max_apply = int(cfg.get("max_applies_per_tick", 3))
    next_pending: list[str] = []
    for idx, run_key in enumerate(pending):
        if idx >= max_apply:
            next_pending.extend(pending[idx:])
            break
        result = safe_apply_for_run(run_key, cfg)
        if result.get("ok"):
            applied.append(result)
            processed[run_key] = {"ts": now_iso(), "status": result.get("status"), "commit": result.get("commit")}
            if result.get("status") == "applied":
                state["last_applied_run"] = run_key
                state["last_applied_commit"] = result.get("commit")
        else:
            failed.append({"ts": now_iso(), "run_key": run_key, "status": result.get("status"), "detail": result.get("detail")})
            # guardrail: skip conflicted/failed apply and mark processed to avoid infinite retries
            processed[run_key] = {"ts": now_iso(), "status": result.get("status")}

    state["active_keys"] = sorted(current_active)
    state["pending"] = next_pending
    state["processed"] = processed
    state["failures"] = (state.get("failures", []) + failed)[-100:]
    state["updated_at"] = now_iso()

    cycle = {
        "newly_completed": newly_completed,
        "applied": applied,
        "failed": failed,
        "active_count": len(current_active),
        "pending_count": len(next_pending),
    }
    return state, cycle


def load_cfg(path: Path) -> dict[str, Any]:
    cfg = {
        "poll_seconds": 30,
        "active_window_minutes": 20,
        "lock_stale_seconds": 180,
        "max_applies_per_tick": 3,
        "validation_command": "",
    }
    file_cfg = load_json(path, {})
    if isinstance(file_cfg, dict):
        cfg.update(file_cfg)
    return cfg


def main() -> int:
    ap = argparse.ArgumentParser(description="Completion applier daemon")
    ap.add_argument("--config", default=str(CONFIG_FILE))
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--status", action="store_true")
    args = ap.parse_args()

    ensure_dirs()
    cfg = load_cfg(Path(args.config))
    state = load_json(STATE_FILE, {"active_keys": [], "pending": [], "processed": {}, "failures": []})

    if args.status:
        cycle = {"status": "read_only"}
        write_status(state, cycle)
        print(STATUS_JSON.read_text(encoding="utf-8"))
        return 0

    if not acquire_lock(int(cfg["lock_stale_seconds"])):
        print("completion_applier: another instance is active")
        return 2

    try:
        if args.once:
            state, cycle = tick(cfg, state)
            save_json(STATE_FILE, state)
            write_status(state, cycle)
            print(json.dumps(cycle, indent=2))
            return 0

        while True:
            state, cycle = tick(cfg, state)
            save_json(STATE_FILE, state)
            write_status(state, cycle)
            print(json.dumps(cycle), flush=True)
            time.sleep(max(5, int(cfg["poll_seconds"])))
    finally:
        release_lock()


if __name__ == "__main__":
    raise SystemExit(main())
