#!/usr/bin/env python3
"""Outcome-gate audit for WORK_QUEUE active items.

Rules:
- Every active NOW item must include `Outcome metric:` or `Outcome metrics:` metadata.
- Missing mapping is flagged as AUTONOMY_GAP.
"""

from __future__ import annotations

import re
from pathlib import Path

WORK_QUEUE = Path(__file__).resolve().parents[1] / "org" / "WORK_QUEUE.md"


def parse_active_now(md: str):
    lines = md.splitlines()
    in_now = False
    tasks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("## "):
            in_now = line[3:].strip().lower() in {"now (active)", "now"}
            i += 1
            continue

        if in_now:
            m = re.match(r"^\s*(\d+)\.\s+\*\*(.+?)\*\*", line)
            if m:
                rank = int(m.group(1))
                title = m.group(2).strip()
                status = ""
                metrics = []
                j = i + 1
                while j < len(lines) and not re.match(r"^\s*\d+\.\s+\*\*", lines[j]) and not lines[j].startswith("## "):
                    s = re.search(r"Status:\s*(.+)$", lines[j], flags=re.IGNORECASE)
                    if s:
                        status = s.group(1).strip()
                    om = re.search(r"Outcome\s*metric(?:s)?\s*:\s*(.+)$", lines[j], flags=re.IGNORECASE)
                    if om:
                        metrics = [p.strip() for p in re.split(r"[,;]", om.group(1)) if p.strip()]
                    j += 1
                tasks.append({"rank": rank, "title": title, "status": status, "metrics": metrics})
                i = j
                continue
        i += 1
    return tasks


def main() -> int:
    if not WORK_QUEUE.exists():
        print("Outcome Gate Report: WORK_QUEUE.md missing")
        return 1

    tasks = parse_active_now(WORK_QUEUE.read_text(encoding="utf-8"))
    print("# Outcome Gate Report")
    print(f"Active NOW tasks: {len(tasks)}")

    gaps = 0
    for t in tasks:
        mapped = bool(t["metrics"])
        state = "OK" if mapped else "AUTONOMY_GAP"
        if not mapped:
            gaps += 1
        metrics = ", ".join(t["metrics"]) if t["metrics"] else "(none)"
        status = t["status"] or "(unspecified)"
        print(f"- [{state}] {t['title']} | status={status} | outcome_metrics={metrics}")

    print(f"Summary: {len(tasks) - gaps} mapped, {gaps} AUTONOMY_GAP")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
