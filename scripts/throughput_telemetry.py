#!/usr/bin/env python3
"""Lightweight throughput telemetry for subagent runs.

Local-first parser that inspects workspace artifacts (memory/*.md + org/WORK_QUEUE.md)
and emits a compact summary for parallelization tuning.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

RUN_ID_RE = re.compile(r"\b([a-f0-9]{8})\b")
TIME_RE = re.compile(r"\b(\d{2}):(\d{2})\b")

SPAWN_HINTS = ("spawned", "started", "in progress", "delegated")
DONE_HINTS = ("done", "completed", "marked", "finished")
FAIL_HINTS = ("failed", "error", "timeout", "throttle", "rate limit")


@dataclass
class RunRecord:
    run_id: str
    first_seen: dt.datetime | None = None
    spawned_at: dt.datetime | None = None
    done_at: dt.datetime | None = None
    failed: bool = False
    mentions: int = 0
    sources: set[str] = field(default_factory=set)

    @property
    def status(self) -> str:
        if self.failed:
            return "failed_or_retry"
        if self.done_at:
            return "done"
        if self.spawned_at:
            return "active_or_unknown"
        return "mentioned"

    def runtime_minutes(self, default_minutes: float) -> float:
        if self.spawned_at and self.done_at and self.done_at >= self.spawned_at:
            observed = round((self.done_at - self.spawned_at).total_seconds() / 60.0, 1)
            return observed if observed >= 1.0 else 1.0
        return default_minutes


def parse_timestamp(line: str, file_date: dt.date | None) -> dt.datetime | None:
    m = TIME_RE.search(line)
    if not m or not file_date:
        return None
    hour, minute = int(m.group(1)), int(m.group(2))
    return dt.datetime.combine(file_date, dt.time(hour=hour, minute=minute))


def classify_line(line: str) -> tuple[bool, bool, bool]:
    low = line.lower()
    is_spawn = any(k in low for k in SPAWN_HINTS)
    is_done = any(k in low for k in DONE_HINTS)
    is_fail = any(k in low for k in FAIL_HINTS)
    return is_spawn, is_done, is_fail


def scan_file(path: Path, runs: dict[str, RunRecord]) -> None:
    file_date = None
    if path.parent.name == "memory":
        try:
            file_date = dt.date.fromisoformat(path.stem)
        except ValueError:
            file_date = None

    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except Exception:
        return

    for line in lines:
        run_ids = RUN_ID_RE.findall(line)
        if not run_ids:
            continue

        ts = parse_timestamp(line, file_date)
        is_spawn, is_done, is_fail = classify_line(line)

        fail_scoped_ids: set[str] = set()
        if is_fail:
            lower = line.lower()
            for m in re.finditer(r"(?:run\s+)?([a-f0-9]{8})[^\n]{0,20}failed", lower):
                fail_scoped_ids.add(m.group(1))
            for m in re.finditer(r"failed[^\n]{0,20}(?:run\s+)?([a-f0-9]{8})", lower):
                fail_scoped_ids.add(m.group(1))

        for run_id in run_ids:
            rec = runs.setdefault(run_id, RunRecord(run_id=run_id))
            rec.mentions += 1
            rec.sources.add(str(path))
            if ts and (rec.first_seen is None or ts < rec.first_seen):
                rec.first_seen = ts
            if is_spawn and ts and (rec.spawned_at is None or ts < rec.spawned_at):
                rec.spawned_at = ts
            if is_done and ts and (rec.done_at is None or ts > rec.done_at):
                rec.done_at = ts
            if is_fail and (not fail_scoped_ids or run_id in fail_scoped_ids):
                rec.failed = True


def discover_files(root: Path, since_days: int) -> Iterable[Path]:
    memory_dir = root / "memory"
    cutoff = dt.date.today() - dt.timedelta(days=since_days)

    if memory_dir.exists():
        for p in sorted(memory_dir.glob("*.md")):
            try:
                d = dt.date.fromisoformat(p.stem)
                if d >= cutoff:
                    yield p
            except ValueError:
                continue

    queue = root / "org" / "WORK_QUEUE.md"
    if queue.exists():
        yield queue


def build_summary(runs: dict[str, RunRecord], default_minutes: float, tokens_per_run: int) -> dict:
    run_list = list(runs.values())
    total = len(run_list)
    done = sum(1 for r in run_list if r.status == "done")
    failed = sum(1 for r in run_list if r.status == "failed_or_retry")
    active = sum(1 for r in run_list if r.status == "active_or_unknown")

    avg_runtime = round(
        sum(r.runtime_minutes(default_minutes) for r in run_list) / total, 1
    ) if total else 0.0

    est_tokens_total = total * tokens_per_run
    est_tokens_done = done * tokens_per_run

    return {
        "runs_total": total,
        "runs_done": done,
        "runs_active_or_unknown": active,
        "runs_failed_or_retry": failed,
        "avg_runtime_minutes_est": avg_runtime,
        "est_tokens_per_run": tokens_per_run,
        "est_tokens_total": est_tokens_total,
        "est_tokens_done": est_tokens_done,
        "notes": "Runtime/token values are placeholders unless explicit timing/token logs are available.",
    }


def print_human(summary: dict, run_records: list[RunRecord], default_minutes: float) -> None:
    print("# Throughput Telemetry (local artifacts)")
    print(f"runs_total: {summary['runs_total']}")
    print(f"runs_done: {summary['runs_done']}")
    print(f"runs_active_or_unknown: {summary['runs_active_or_unknown']}")
    print(f"runs_failed_or_retry: {summary['runs_failed_or_retry']}")
    print(f"avg_runtime_minutes_est: {summary['avg_runtime_minutes_est']}")
    print(f"est_tokens_per_run: {summary['est_tokens_per_run']}")
    print(f"est_tokens_total: {summary['est_tokens_total']}")
    print(f"est_tokens_done: {summary['est_tokens_done']}")
    print(f"note: {summary['notes']}")
    print()
    print("run_id,status,runtime_min_est,mentions,sources")
    for r in sorted(run_records, key=lambda x: x.run_id):
        print(
            f"{r.run_id},{r.status},{r.runtime_minutes(default_minutes)},{r.mentions},{'|'.join(sorted(r.sources))}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize subagent throughput from workspace artifacts")
    parser.add_argument("--root", default=".", help="workspace root")
    parser.add_argument("--since-days", type=int, default=3, help="how many recent memory days to scan")
    parser.add_argument("--default-runtime-min", type=float, default=18.0, help="placeholder runtime if exact unknown")
    parser.add_argument("--tokens-per-run", type=int, default=3500, help="placeholder token estimate per run")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    runs: dict[str, RunRecord] = {}

    for f in discover_files(root, args.since_days):
        scan_file(f, runs)

    summary = build_summary(runs, args.default_runtime_min, args.tokens_per_run)
    records = list(runs.values())

    output = {"summary": summary, "runs": [
        {
            "run_id": r.run_id,
            "status": r.status,
            "runtime_minutes_est": r.runtime_minutes(args.default_runtime_min),
            "mentions": r.mentions,
            "sources": sorted(r.sources),
        }
        for r in sorted(records, key=lambda x: x.run_id)
    ]}

    if args.json:
        print(json.dumps(output, indent=2))
    else:
        print_human(summary, records, args.default_runtime_min)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
