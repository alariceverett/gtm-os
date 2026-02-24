#!/usr/bin/env python3
"""Permanent role-based swarm runtime.

Features:
- Role-based coordinator (planner/builder/integrator/qa/design/release)
- Handoff packet schema enforcement between roles
- Cap-aware scheduling (active child cap, default 5)
- Status output for active swarm lanes in /ops
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ORG = ROOT / "org"
OPS = ROOT / "ops"
MEMORY = ROOT / "memory" / "swarm_runtime"
WORK_QUEUE = ORG / "WORK_QUEUE.md"
CONFIG_FILE = ORG / "swarm_runtime.config.json"
MODEL_LANE_FILE = ORG / "MODEL_LANE_MAPPING.json"
STATE_FILE = MEMORY / "state.json"
STATUS_FILE = OPS / "swarm_lanes.json"
STATUS_MD_FILE = OPS / "swarm_lanes.md"
LOCK_FILE = MEMORY / "runtime.lock"

ROLES = ["planner", "builder", "integrator", "qa", "design", "release"]
ROLE_TO_MODEL_LANE = {
    "planner": "strategy",
    "builder": "execution",
    "integrator": "execution",
    "qa": "qa_gate",
    "design": "design_critic",
    "release": "release_comms",
}


def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat()


def sh(cmd: list[str], timeout: int = 20) -> tuple[int, str, str]:
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


def active_subagents(active_minutes: int) -> int:
    code, out, _err = sh(["openclaw", "sessions", "--active", str(active_minutes), "--json"])
    if code != 0:
        return 0
    try:
        sessions = json.loads(out).get("sessions", [])
        return sum(1 for s in sessions if str(s.get("key", "")).startswith("agent:main:subagent:"))
    except Exception:
        return 0


def parse_queue_titles(limit: int = 12) -> list[str]:
    if not WORK_QUEUE.exists():
        return []
    lines = WORK_QUEUE.read_text(encoding="utf-8").splitlines()
    out: list[str] = []
    for line in lines:
        m = re.match(r"^\s*\d+\.\s+\*\*(.+?)\*\*", line)
        if m:
            out.append(m.group(1).strip())
            if len(out) >= limit:
                break
    return out


def lane_id_for(title: str) -> str:
    return hashlib.sha1(title.encode("utf-8")).hexdigest()[:10]


def create_lane(title: str) -> dict[str, Any]:
    return {
        "lane_id": lane_id_for(title),
        "task_title": title,
        "status": "ready",
        "current_role": "planner",
        "active_session": None,
        "handoffs": [],
        "last_update": now_iso(),
    }


def acquire_lock(stale_seconds: int = 180) -> bool:
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


def role_prompt(lane: dict[str, Any], role: str) -> str:
    next_idx = ROLES.index(role) + 1
    next_role = ROLES[next_idx] if next_idx < len(ROLES) else "done"
    return (
        f"[SWARM LANE {lane['lane_id']}] Role={role}. Task={lane['task_title']}\n"
        f"Produce a handoff packet JSON for next_role={next_role}.\n"
        "Required fields: lane_id, from_role, to_role, task_title, summary, deliverables, checks, risks, next_actions, artifacts, timestamp.\n"
        "Return changed files + run commands + verification markers."
    )


def load_model_lane_mapping() -> dict[str, Any]:
    mapping = load_json(MODEL_LANE_FILE, {})
    return mapping if isinstance(mapping, dict) else {}


def resolve_spawn_lane_model(role: str, mapping: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    model_lane = ROLE_TO_MODEL_LANE.get(role)
    if not model_lane:
        return None, None, "CONTEXT_GAP:missing_model_lane_for_role"
    lane_cfg = mapping.get(model_lane)
    if not isinstance(lane_cfg, dict):
        return model_lane, None, f"CONTEXT_GAP:missing_mapping:{model_lane}"
    model = lane_cfg.get("model")
    if not isinstance(model, str) or not model.strip():
        return model_lane, None, f"CONTEXT_GAP:missing_model:{model_lane}"
    return model_lane, model.strip(), None


def append_spawn_audit(
    state: dict[str, Any],
    lane: dict[str, Any],
    role: str,
    model_lane: str | None,
    model: str | None,
    status: str,
    detail: str,
) -> None:
    entry = {
        "ts": now_iso(),
        "lane_id": lane.get("lane_id"),
        "task_title": lane.get("task_title"),
        "role": role,
        "model_lane": model_lane,
        "model": model,
        "status": status,
        "detail": detail[:240],
    }
    audit = state.get("spawn_audit")
    if not isinstance(audit, list):
        audit = []
    audit.append(entry)
    state["spawn_audit"] = audit[-20:]


def spawn_role(cfg: dict[str, Any], lane: dict[str, Any], model_mapping: dict[str, Any], state: dict[str, Any]) -> tuple[bool, str]:
    role = lane["current_role"]
    model_lane, model, context_gap = resolve_spawn_lane_model(role, model_mapping)
    lane["model_lane"] = model_lane
    lane["model"] = model
    if context_gap:
        append_spawn_audit(state, lane, role, model_lane, model, "context_gap", context_gap)
        return False, context_gap

    prompt = role_prompt(lane, role)
    params = {
        "parentSessionKey": cfg["parent_session_key"],
        "sessionKey": cfg["parent_session_key"],
        "label": f"swarm:{lane['lane_id']}:{role}",
        "message": prompt,
        "task": prompt,
        "model": model,
    }
    code, out, err = sh(
        [
            "openclaw",
            "gateway",
            "call",
            cfg["spawn_method"],
            "--json",
            "--timeout",
            "10000",
            "--params",
            json.dumps(params),
        ],
        timeout=25,
    )
    if code != 0:
        detail = err or out or "spawn failed"
        append_spawn_audit(state, lane, role, model_lane, model, "spawn_failed", detail)
        return False, detail
    append_spawn_audit(state, lane, role, model_lane, model, "spawned", out[:500])
    return True, out[:500]


def validate_handoff(packet: dict[str, Any], expected_from: str, expected_to: str, lane: dict[str, Any]) -> tuple[bool, list[str]]:
    required = [
        "lane_id",
        "from_role",
        "to_role",
        "task_title",
        "summary",
        "deliverables",
        "checks",
        "risks",
        "next_actions",
        "artifacts",
        "timestamp",
    ]
    errors: list[str] = []
    for k in required:
        if k not in packet:
            errors.append(f"missing:{k}")
    if packet.get("lane_id") != lane["lane_id"]:
        errors.append("lane_id_mismatch")
    if packet.get("from_role") != expected_from:
        errors.append("from_role_mismatch")
    if packet.get("to_role") != expected_to:
        errors.append("to_role_mismatch")
    if packet.get("task_title") != lane["task_title"]:
        errors.append("task_title_mismatch")
    for list_key in ["deliverables", "checks", "risks", "next_actions", "artifacts"]:
        if list_key in packet and not isinstance(packet[list_key], list):
            errors.append(f"type_error:{list_key}")
    return len(errors) == 0, errors


def write_status(state: dict[str, Any], cfg: dict[str, Any]) -> None:
    active_lanes = [l for l in state["lanes"] if l["status"] != "done"]
    model_mapping = load_model_lane_mapping()

    def status_pair(lane: dict[str, Any]) -> dict[str, Any]:
        role = str(lane.get("current_role", ""))
        model_lane = lane.get("model_lane")
        model = lane.get("model")
        if not model_lane or not model:
            inferred_lane, inferred_model, _gap = resolve_spawn_lane_model(role, model_mapping)
            model_lane = model_lane or inferred_lane
            model = model or inferred_model
        return {
            "lane_id": lane.get("lane_id"),
            "role": role,
            "model_lane": model_lane,
            "model": model,
            "status": lane.get("status"),
        }

    active_lane_model_pairs = [status_pair(lane) for lane in active_lanes]
    payload = {
        "ts": now_iso(),
        "cap": cfg["active_child_cap"],
        "active_subagents": active_subagents(cfg["active_window_minutes"]),
        "active_lane_count": len(active_lanes),
        "lanes": active_lanes,
        "active_lane_model_pairs": active_lane_model_pairs,
        "spawn_audit_last_20": state.get("spawn_audit", []),
        "ops_markers": [
            "ops.swarm_runtime.active_lane_model_pairs",
            "ops.swarm_runtime.spawn_audit_last_20",
        ],
    }
    save_json(STATUS_FILE, payload)

    lines = [
        "# Swarm Runtime Status",
        f"- Updated: {payload['ts']}",
        f"- Active child cap: {payload['cap']}",
        f"- Active subagents: {payload['active_subagents']}",
        f"- Active lanes: {payload['active_lane_count']}",
        "",
        "## /ops markers",
        "- ops.swarm_runtime.active_lane_model_pairs",
        "- ops.swarm_runtime.spawn_audit_last_20",
        "",
        "| Lane | Task | Role | Model lane | Model | Status | Handoffs |",
        "|---|---|---|---|---|---|---|",
    ]
    pairs_by_lane_id = {str(p.get('lane_id')): p for p in active_lane_model_pairs}
    for lane in active_lanes:
        pair = pairs_by_lane_id.get(str(lane.get("lane_id")), {})
        lines.append(
            f"| {lane['lane_id']} | {lane['task_title']} | {lane['current_role']} | {pair.get('model_lane', '-') or '-'} | {pair.get('model', '-') or '-'} | {lane['status']} | {len(lane['handoffs'])} |"
        )

    lines += ["", "## Spawn audit (last 20)", "| Time | Lane | Role | Model lane | Model | Status |", "|---|---|---|---|---|---|"]
    for row in payload["spawn_audit_last_20"]:
        lines.append(
            f"| {row.get('ts','')} | {row.get('lane_id','')} | {row.get('role','')} | {row.get('model_lane','-') or '-'} | {row.get('model','-') or '-'} | {row.get('status','')} |"
        )
    STATUS_MD_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_cfg() -> dict[str, Any]:
    cfg = {
        "parent_session_key": "agent:main:main",
        "spawn_method": "sessions_spawn",
        "active_window_minutes": 30,
        "active_child_cap": 5,
        "poll_seconds": 45,
        "max_lanes": 6,
    }
    file_cfg = load_json(CONFIG_FILE, {})
    if isinstance(file_cfg, dict):
        cfg.update(file_cfg)
    cap_env = os.getenv("SWARM_ACTIVE_CHILD_CAP")
    if cap_env and cap_env.isdigit():
        cfg["active_child_cap"] = int(cap_env)
    cfg["active_child_cap"] = min(max(int(cfg["active_child_cap"]), 1), 5)
    return cfg


def init_state_if_empty(state: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    if state.get("lanes"):
        return state
    titles = parse_queue_titles(limit=cfg["max_lanes"])
    state["lanes"] = [create_lane(t) for t in titles]
    state["created_at"] = now_iso()
    return state


def scheduler_tick(state: dict[str, Any], cfg: dict[str, Any]) -> dict[str, Any]:
    model_mapping = load_model_lane_mapping()
    current_active = active_subagents(cfg["active_window_minutes"])
    available = max(0, cfg["active_child_cap"] - current_active)
    spawned = 0
    for lane in state["lanes"]:
        if available <= 0:
            break
        if lane["status"] != "ready":
            continue
        ok, detail = spawn_role(cfg, lane, model_mapping, state)
        lane["last_update"] = now_iso()
        if ok:
            lane["status"] = "in_progress"
            lane["active_session"] = {"label": f"swarm:{lane['lane_id']}:{lane['current_role']}"}
            spawned += 1
            available -= 1
        else:
            lane["status"] = "context_gap" if str(detail).startswith("CONTEXT_GAP:") else "blocked"
            lane["block_reason"] = detail
    state["last_tick"] = {"ts": now_iso(), "spawned": spawned, "active": current_active, "cap": cfg["active_child_cap"]}
    return state


def submit_handoff(state: dict[str, Any], lane_id: str, packet_file: Path) -> tuple[dict[str, Any], bool, str]:
    lane = next((l for l in state["lanes"] if l["lane_id"] == lane_id), None)
    if not lane:
        return state, False, "lane_not_found"
    packet = load_json(packet_file, None)
    if not isinstance(packet, dict):
        return state, False, "invalid_packet_json"

    from_role = lane["current_role"]
    next_idx = ROLES.index(from_role) + 1
    to_role = ROLES[next_idx] if next_idx < len(ROLES) else "done"

    ok, errors = validate_handoff(packet, from_role, to_role, lane)
    lane["last_update"] = now_iso()
    if not ok:
        lane["status"] = "handoff_rejected"
        lane["handoff_errors"] = errors
        return state, False, "handoff_schema_rejected"

    lane["handoffs"].append(packet)
    lane["active_session"] = None
    lane.pop("handoff_errors", None)
    lane.pop("block_reason", None)

    if to_role == "done":
        lane["status"] = "done"
    else:
        lane["current_role"] = to_role
        lane["status"] = "ready"
    return state, True, "ok"


def main() -> int:
    ap = argparse.ArgumentParser(description="Permanent swarm runtime")
    ap.add_argument("--tick", action="store_true", help="Run one scheduler tick")
    ap.add_argument("--status", action="store_true", help="Write/read /ops status")
    ap.add_argument("--init", action="store_true", help="Initialize lanes from WORK_QUEUE")
    ap.add_argument("--submit-handoff", nargs=2, metavar=("LANE_ID", "PACKET_JSON"), help="Validate handoff and advance lane")
    args = ap.parse_args()

    ensure_dirs()
    cfg = load_cfg()
    state = load_json(STATE_FILE, {"lanes": []})

    if args.init:
        state = init_state_if_empty(state, cfg)
        save_json(STATE_FILE, state)
        write_status(state, cfg)
        print(json.dumps({"ok": True, "lanes": len(state.get('lanes', []))}, indent=2))
        return 0

    if args.submit_handoff:
        lane_id, packet = args.submit_handoff
        state, ok, msg = submit_handoff(state, lane_id, Path(packet))
        save_json(STATE_FILE, state)
        write_status(state, cfg)
        print(json.dumps({"ok": ok, "message": msg}, indent=2))
        return 0 if ok else 2

    if args.status:
        state = init_state_if_empty(state, cfg)
        save_json(STATE_FILE, state)
        write_status(state, cfg)
        print(STATUS_FILE.read_text(encoding="utf-8"))
        return 0

    if not acquire_lock():
        print("swarm_runtime: another instance is active")
        return 2

    try:
        state = init_state_if_empty(state, cfg)
        if args.tick:
            state = scheduler_tick(state, cfg)
            save_json(STATE_FILE, state)
            write_status(state, cfg)
            print(json.dumps(state.get("last_tick", {}), indent=2))
            return 0

        while True:
            state = scheduler_tick(state, cfg)
            save_json(STATE_FILE, state)
            write_status(state, cfg)
            time.sleep(max(5, int(cfg["poll_seconds"])))
    finally:
        release_lock()


if __name__ == "__main__":
    raise SystemExit(main())
