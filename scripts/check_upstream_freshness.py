#!/usr/bin/env python3
"""Upstream freshness guard for Forge feedback cadence.

Passes when either:
- Execution is not currently active, OR
- Latest upstream touchpoint is < max-age-minutes old.

Active execution is inferred from org/WORK_QUEUE.md statuses unless --active is set.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

ACTIVE_TOKENS = {
    "in progress",
    "partial done",
    "awaiting result extraction",
    "running",
    "active",
}

TS_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))\b")


def parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser(description="Check Forge upstream freshness cadence")
    p.add_argument("--max-age-minutes", type=int, default=60)
    p.add_argument("--log", type=Path, default=root / "org" / "feedback" / "UPSTREAM_CADENCE_LOG.md")
    p.add_argument("--work-queue", type=Path, default=root / "org" / "WORK_QUEUE.md")
    p.add_argument("--active", action="store_true", help="Force active mode")
    return p.parse_args()


def is_active_from_work_queue(path: Path) -> bool:
    if not path.exists():
        return False
    txt = path.read_text(encoding="utf-8", errors="ignore")
    in_now = False
    for raw in txt.splitlines():
        line = raw.strip()
        if line.startswith("## "):
            in_now = line.lower().startswith("## now")
            continue
        if not in_now:
            continue
        if line.lower().startswith("status:"):
            status = line.split(":", 1)[1].strip().lower()
            if any(tok in status for tok in ACTIVE_TOKENS):
                return True
    return False


def parse_iso(ts: str) -> dt.datetime:
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    return dt.datetime.fromisoformat(ts)


def latest_touchpoint(path: Path) -> dt.datetime | None:
    if not path.exists():
        return None
    latest: dt.datetime | None = None
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = TS_RE.search(line)
        if not m:
            continue
        try:
            candidate = parse_iso(m.group(1)).astimezone(dt.timezone.utc)
        except Exception:
            continue
        if latest is None or candidate > latest:
            latest = candidate
    return latest


def main() -> int:
    args = parse_args()
    active = args.active or is_active_from_work_queue(args.work_queue)

    if not active:
        print("UPSTREAM_FRESHNESS: SKIP (execution not active)")
        return 0

    latest = latest_touchpoint(args.log)
    if latest is None:
        print("UPSTREAM_FRESHNESS: FAIL (no cadence log timestamp found while active)")
        print(f"Expected ISO-8601 entries in: {args.log}")
        return 1

    now = dt.datetime.now(dt.timezone.utc)
    age_min = (now - latest).total_seconds() / 60.0

    if age_min < args.max_age_minutes:
        print(f"UPSTREAM_FRESHNESS: PASS (latest touchpoint {age_min:.1f}m ago < {args.max_age_minutes}m)")
        return 0

    print(f"UPSTREAM_FRESHNESS: FAIL (latest touchpoint {age_min:.1f}m ago >= {args.max_age_minutes}m)")
    print("Remediation: update or comment on the active Forge upstream issue, then append a new log line.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
