#!/usr/bin/env python3
"""Always-on autopull runner for OpenClaw workspace.

Goals:
- Keep at least `target_workers` active subagent sessions.
- Pull next highest-priority unblocked queue task from org/WORK_QUEUE.md.
- Spawn via Gateway `sessions_spawn` flow when available.
- Use lock + state idempotency to avoid duplicate spawns.
- Completion-triggered refill: watch session updates and refill immediately on completion bursts.
- Heartbeat-safe fallback: if event stream is unavailable, continue periodic polling.
- Log to memory and emit a simple status JSON.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ORG = ROOT / "org"
MEMORY = ROOT / "memory"
STATE_DIR = MEMORY / "autopull"
WORK_QUEUE = ORG / "WORK_QUEUE.md"
DEFAULT_CONFIG = ORG / "autopull.config.json"
LOCK_FILE = STATE_DIR / "runner.lock"
STATE_FILE = STATE_DIR / "state.json"
STATUS_FILE = STATE_DIR / "status.json"
DEFERRED_FILE = STATE_DIR / "deferred_spawns.json"
EVENTS_FILE = STATE_DIR / "events.jsonl"
MIN_TARGET_WORKERS = 4
DEFAULT_SESSION_CAP = 5


@dataclass
class QueueTask:
    section: str
    rank: int
    title: str
    status: str
    raw: str
    outcome_metrics: list[str]
    autonomy_gap: bool = False


def sh(cmd: list[str], timeout: int = 20) -> tuple[int, str, str]:
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def now_local() -> dt.datetime:
    return dt.datetime.now().astimezone()


def ensure_dirs() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    MEMORY.mkdir(parents=True, exist_ok=True)


def append_memory(line: str) -> None:
    d = now_local().strftime("%Y-%m-%d")
    f = MEMORY / f"{d}.md"
    ts = now_local().strftime("%H:%M %Z")
    with f.open("a", encoding="utf-8") as fh:
        fh.write(f"- {ts} autopull: {line}\n")


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def append_event(event: dict[str, Any]) -> None:
    payload = dict(event)
    payload.setdefault("ts", now_local().isoformat())
    with EVENTS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(payload, sort_keys=True) + "\n")


def detect_session_cap(cfg: dict[str, Any]) -> int:
    env_cap = os.getenv("AUTOPULL_SESSION_CAP")
    if env_cap and env_cap.isdigit():
        return max(1, int(env_cap))

    cfg_cap = cfg.get("session_cap")
    if isinstance(cfg_cap, int) and cfg_cap > 0:
        return cfg_cap
    if isinstance(cfg_cap, str) and cfg_cap.isdigit():
        return max(1, int(cfg_cap))

    try:
        txt = (ORG / "OBJECTIVES.md").read_text(encoding="utf-8")
        m = re.search(r"platform cap:\s*(\d+)", txt, flags=re.IGNORECASE)
        if m:
            return max(1, int(m.group(1)))
    except Exception:
        pass

    return DEFAULT_SESSION_CAP


def acquire_lock(stale_seconds: int) -> bool:
    now = int(time.time())
    if LOCK_FILE.exists():
        try:
            data = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
            ts = int(data.get("ts", 0))
            pid = int(data.get("pid", -1))
            if now - ts < stale_seconds:
                try:
                    os.kill(pid, 0)
                    return False
                except Exception:
                    pass
        except Exception:
            pass
        # stale lock
        LOCK_FILE.unlink(missing_ok=True)

    payload = {"pid": os.getpid(), "ts": now, "host": os.uname().nodename}
    LOCK_FILE.write_text(json.dumps(payload), encoding="utf-8")
    return True


def release_lock() -> None:
    LOCK_FILE.unlink(missing_ok=True)


def parse_queue(md: str) -> list[QueueTask]:
    tasks: list[QueueTask] = []
    section = ""
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if line.startswith("## "):
            section = line[3:].strip().lower()
            i += 1
            continue
        m = re.match(r"^\s*(\d+)\.\s+\*\*(.+?)\*\*", line)
        if not m:
            i += 1
            continue
        rank = int(m.group(1))
        title = m.group(2).strip()
        status = ""
        outcome_metrics: list[str] = []
        raw = [line]
        j = i + 1
        while j < len(lines) and not re.match(r"^\s*\d+\.\s+\*\*", lines[j]) and not lines[j].startswith("## "):
            raw.append(lines[j])
            s = re.search(r"Status:\s*(.+)$", lines[j], flags=re.IGNORECASE)
            if s:
                status = s.group(1).strip()
            om = re.search(r"Outcome\s*metric(?:s)?\s*:\s*(.+)$", lines[j], flags=re.IGNORECASE)
            if om:
                outcome_metrics = [p.strip() for p in re.split(r"[,;]", om.group(1)) if p.strip()]
            j += 1
        tasks.append(
            QueueTask(
                section=section,
                rank=rank,
                title=title,
                status=status,
                raw="\n".join(raw),
                outcome_metrics=outcome_metrics,
            )
        )
        i = j
    return tasks


def apply_outcome_gate(tasks: list[QueueTask]) -> list[QueueTask]:
    """Mark active NOW items missing outcome metrics as AUTONOMY_GAP."""
    for t in tasks:
        low_section = t.section.lower()
        low_status = (t.status or "").lower()
        is_now = low_section in {"now (active)", "now"}
        is_active = any(s in low_status for s in ["in progress", "active", "in-progress"]) or low_status == ""
        if is_now and is_active and not t.outcome_metrics:
            t.autonomy_gap = True
            t.status = "AUTONOMY_GAP"
    return tasks


def eligible_tasks(tasks: list[QueueTask]) -> list[QueueTask]:
    candidates: list[QueueTask] = []
    for t in tasks:
        if t.section not in {"now (active)", "next (queued)", "now", "next"}:
            continue
        low = (t.status or "").lower()
        if t.autonomy_gap:
            continue
        if any(x in low for x in ["done", "blocked", "in progress", "partial done", "failed", "awaiting result extraction"]):
            continue
        candidates.append(t)

    sec_order = {"now (active)": 0, "now": 0, "next (queued)": 1, "next": 1}
    candidates.sort(key=lambda t: (sec_order.get(t.section, 9), t.rank))
    return candidates


def active_subagents(active_minutes: int) -> int:
    code, out, _err = sh(["openclaw", "sessions", "--active", str(active_minutes), "--json"], timeout=20)
    if code != 0:
        return 0
    try:
        data = json.loads(out)
        sessions = data.get("sessions", [])
        return sum(1 for s in sessions if str(s.get("key", "")).startswith("agent:main:subagent:"))
    except Exception:
        return 0


def detect_session_store_path() -> Path | None:
    code, out, _err = sh(["openclaw", "sessions", "--json", "--verbose"], timeout=20)
    if code != 0:
        return None
    try:
        data = json.loads(out)
        p = data.get("path")
        if not p:
            return None
        store = Path(str(p)).expanduser()
        return store if store.exists() else None
    except Exception:
        return None


def session_store_mtime(store: Path | None) -> float | None:
    if not store:
        return None
    try:
        return store.stat().st_mtime
    except Exception:
        return None


def wait_for_refill_trigger(
    cfg: dict[str, Any],
    last_active: int,
    last_refill_ts: float,
    last_mtime: float | None,
) -> tuple[str, int, float | None]:
    """Wait for either completion event or heartbeat timeout.

    Returns: (trigger, observed_active, observed_mtime)
    trigger in {"completion_event", "heartbeat", "event_unavailable"}
    """
    poll_seconds = max(int(cfg.get("poll_seconds", 45)), 1)
    if not bool(cfg.get("event_hook_enabled", True)):
        time.sleep(poll_seconds)
        return "heartbeat", last_active, last_mtime

    event_check_ms = max(int(cfg.get("event_check_ms", 750)), 100)
    min_refill_s = max(int(cfg.get("event_refill_debounce_seconds", 2)), 0)
    store = detect_session_store_path()
    mtime = session_store_mtime(store)

    if store is None or mtime is None:
        time.sleep(poll_seconds)
        return "event_unavailable", last_active, last_mtime

    if last_mtime is None:
        last_mtime = mtime

    deadline = time.time() + poll_seconds
    observed_active = last_active

    while time.time() < deadline:
        cur_mtime = session_store_mtime(store)
        if cur_mtime is None:
            return "event_unavailable", observed_active, last_mtime

        if cur_mtime > (last_mtime or 0):
            cur_active = active_subagents(int(cfg["active_window_minutes"]))
            if cur_active < observed_active:
                if (time.time() - last_refill_ts) >= min_refill_s:
                    return "completion_event", cur_active, cur_mtime
            observed_active = cur_active
            last_mtime = cur_mtime

        time.sleep(event_check_ms / 1000.0)

    return "heartbeat", observed_active, last_mtime


def task_key(task: QueueTask) -> str:
    h = hashlib.sha1(f"{task.section}|{task.rank}|{task.title}".encode("utf-8")).hexdigest()
    return h


def spawn_via_gateway(task: QueueTask, session_key: str, spawn_method: str) -> tuple[bool, str]:
    brief = (
        f"[AUTOPULL] Dequeue + execute top unblocked task from WORK_QUEUE.\\n"
        f"Task: {task.title}\\n"
        f"Section: {task.section} rank={task.rank}\\n"
        f"Constraints: local-first, no destructive actions, report changed files + run commands."
    )

    params = {
        "parentSessionKey": session_key,
        "sessionKey": session_key,
        "message": brief,
        "task": brief,
        "label": f"autopull:{re.sub(r'[^a-z0-9]+', '-', task.title.lower()).strip('-')[:48]}",
    }

    cmd = [
        "openclaw",
        "gateway",
        "call",
        spawn_method,
        "--json",
        "--timeout",
        "10000",
        "--params",
        json.dumps(params),
    ]
    code, out, err = sh(cmd, timeout=25)
    if code != 0:
        return False, (err or out or f"spawn method {spawn_method} failed")
    return True, out[:1000]


def run_once(cfg: dict[str, Any]) -> dict[str, Any]:
    if not WORK_QUEUE.exists():
        msg = "WORK_QUEUE.md missing; heartbeat-safe noop"
        append_memory(msg)
        return {"ok": False, "reason": msg}

    md = WORK_QUEUE.read_text(encoding="utf-8")
    all_tasks = apply_outcome_gate(parse_queue(md))
    tasks = eligible_tasks(all_tasks)
    active = active_subagents(int(cfg["active_window_minutes"]))
    deferred = load_json(DEFERRED_FILE, [])
    pending = len(deferred)

    session_cap = detect_session_cap(cfg)
    configured_target = int(cfg["target_workers"])
    effective_target = min(configured_target, session_cap)
    capacity = effective_target - (active + pending)

    state = load_json(STATE_FILE, {"recent": []})
    recent: list[dict[str, Any]] = state.get("recent", [])[-100:]

    autonomy_gaps = [t for t in all_tasks if t.autonomy_gap]

    outcome: dict[str, Any] = {
        "ts": now_local().isoformat(),
        "session_cap": session_cap,
        "configured_target_workers": configured_target,
        "target_workers": effective_target,
        "current_active": active,
        "active_subagents": active,
        "pending_deferred": pending,
        "capacity": capacity,
        "candidate_tasks": [t.title for t in tasks],
        "autonomy_gap_count": len(autonomy_gaps),
        "autonomy_gap_tasks": [t.title for t in autonomy_gaps],
        "spawned": False,
        "spawned_count": 0,
        "spawn_failures": 0,
        "idempotency_skips": 0,
        "last_refill": state.get("last_refill"),
        "last_miss": state.get("last_miss"),
    }

    if autonomy_gaps:
        append_memory("AUTONOMY_GAP: active tasks missing outcome metric mapping -> " + "; ".join(t.title for t in autonomy_gaps))

    if capacity <= 0:
        outcome["note"] = "at/above target_workers"
        return outcome

    if not tasks:
        miss = {
            "ts": now_local().isoformat(),
            "reason": "no_unblocked_work",
            "current_active": active,
            "target_workers": effective_target,
            "needed": max(capacity, 0),
        }
        state["last_miss"] = miss
        append_event({"event": "refill_miss", **miss})
        outcome["last_miss"] = miss
        outcome["note"] = "no unblocked queued tasks"
        state["recent"] = recent[-100:]
        save_json(STATE_FILE, state)
        return outcome

    cooldown_s = int(cfg.get("idempotency_cooldown_seconds", 900))
    now_ts = int(time.time())

    for task in tasks:
        if outcome["spawned_count"] >= capacity:
            break

        key = task_key(task)
        duplicate = any(r.get("task_key") == key and now_ts - int(r.get("ts", 0)) < cooldown_s for r in recent)
        if duplicate:
            outcome["idempotency_skips"] += 1
            continue

        ok, detail = spawn_via_gateway(task, str(cfg["parent_session_key"]), str(cfg["spawn_method"]))
        if ok:
            outcome["spawned"] = True
            outcome["spawned_count"] += 1
            recent.append({"ts": now_ts, "task_key": key, "title": task.title, "status": "spawned"})
            append_memory(
                f"spawned {task.title} via {cfg['spawn_method']}; active={active} target={effective_target}"
            )
        else:
            # heartbeat-safe fallback: defer intent instead of repeated retries/spam
            deferred.append(
                {
                    "ts": now_local().isoformat(),
                    "task_key": key,
                    "title": task.title,
                    "section": task.section,
                    "rank": task.rank,
                    "reason": detail[:400],
                }
            )
            outcome["spawn_failures"] += 1
            recent.append({"ts": now_ts, "task_key": key, "title": task.title, "status": "deferred"})
            append_memory(f"spawn deferred {task.title}; reason={detail[:140]}")

    if deferred:
        save_json(DEFERRED_FILE, deferred[-100:])

    if outcome["spawned_count"] < capacity:
        outcome["note"] = (
            f"refill incomplete: spawned {outcome['spawned_count']} of needed {capacity}; "
            "limited by available tasks/idempotency/spawn failures"
        )
        miss = {
            "ts": now_local().isoformat(),
            "reason": "insufficient_refill",
            "current_active": active,
            "target_workers": effective_target,
            "needed": capacity,
            "spawned": outcome["spawned_count"],
            "spawn_failures": outcome["spawn_failures"],
            "idempotency_skips": outcome["idempotency_skips"],
        }
        state["last_miss"] = miss
        outcome["last_miss"] = miss
        append_event({"event": "refill_miss", **miss})
    else:
        outcome["note"] = f"refilled to floor by spawning {outcome['spawned_count']}"

    if outcome["spawned_count"] > 0:
        refill = {
            "ts": now_local().isoformat(),
            "current_active": active,
            "target_workers": effective_target,
            "spawned": outcome["spawned_count"],
            "estimated_active_after": active + outcome["spawned_count"],
        }
        state["last_refill"] = refill
        outcome["last_refill"] = refill
        append_event({"event": "refill_action", **refill})

    outcome["estimated_active_after"] = active + outcome["spawned_count"]

    state["recent"] = recent[-100:]
    save_json(STATE_FILE, state)
    return outcome


def load_config(path: Path) -> dict[str, Any]:
    cfg = {
        "target_workers": MIN_TARGET_WORKERS,
        "session_cap": DEFAULT_SESSION_CAP,
        "poll_seconds": 45,
        "active_window_minutes": 30,
        "lock_stale_seconds": 180,
        "idempotency_cooldown_seconds": 900,
        "parent_session_key": "agent:main:main",
        "spawn_method": "sessions_spawn",
        "event_hook_enabled": True,
        "event_check_ms": 750,
        "event_refill_debounce_seconds": 2,
    }
    file_cfg = load_json(path, {})
    if isinstance(file_cfg, dict):
        cfg.update(file_cfg)

    # env override
    tw = os.getenv("AUTOPULL_TARGET_WORKERS")
    if tw and tw.isdigit():
        cfg["target_workers"] = int(tw)

    # Reliability guardrail: never run below minimum worker floor.
    cfg["target_workers"] = max(int(cfg.get("target_workers", MIN_TARGET_WORKERS)), MIN_TARGET_WORKERS)
    return cfg


def main() -> int:
    parser = argparse.ArgumentParser(description="Always-on autopull runner")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to config JSON")
    parser.add_argument("--once", action="store_true", help="Run one cycle")
    parser.add_argument("--status", action="store_true", help="Print current status JSON")
    args = parser.parse_args()

    ensure_dirs()
    cfg = load_config(Path(args.config))

    if args.status:
        status = load_json(STATUS_FILE, {})
        if not isinstance(status, dict):
            status = {}
        state = load_json(STATE_FILE, {})
        current_active = active_subagents(int(cfg["active_window_minutes"]))
        session_cap = detect_session_cap(cfg)
        effective_target = min(int(cfg["target_workers"]), session_cap)
        summary = {
            "ts": now_local().isoformat(),
            "current_active": current_active,
            "target_workers": effective_target,
            "session_cap": session_cap,
            "last_refill": state.get("last_refill"),
            "last_miss": state.get("last_miss"),
            "last_cycle": status,
        }
        print(json.dumps(summary, indent=2))
        return 0

    if not acquire_lock(int(cfg["lock_stale_seconds"])):
        print("autopull_runner: another instance is active", file=sys.stderr)
        return 2

    try:
        if args.once:
            outcome = run_once(cfg)
            save_json(STATUS_FILE, outcome)
            print(json.dumps(outcome, indent=2))
            return 0

        last_refill_ts = 0.0
        last_active = active_subagents(int(cfg["active_window_minutes"]))
        last_mtime: float | None = None

        while True:
            outcome = run_once(cfg)
            outcome["trigger"] = outcome.get("trigger", "startup")
            save_json(STATUS_FILE, outcome)
            print(json.dumps(outcome), flush=True)
            last_refill_ts = time.time()
            last_active = int(outcome.get("active_subagents", last_active))

            trigger, observed_active, observed_mtime = wait_for_refill_trigger(
                cfg=cfg,
                last_active=last_active,
                last_refill_ts=last_refill_ts,
                last_mtime=last_mtime,
            )
            last_active = observed_active
            last_mtime = observed_mtime

            if trigger == "completion_event":
                append_memory(f"completion event detected (active dropped to {observed_active}); triggering immediate refill")
            elif trigger == "event_unavailable":
                append_memory("event stream unavailable; fallback to heartbeat polling")

    finally:
        release_lock()


if __name__ == "__main__":
    raise SystemExit(main())
