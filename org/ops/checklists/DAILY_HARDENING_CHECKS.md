# DAILY_HARDENING_CHECKS

Run each cycle during consolidation window:

1. Route truth check (critical URLs HTTP 200)
2. Golden-path replay pass
3. Interaction debt check (click/context-switch regression)
4. KPI snapshot update (4 canonical metrics)
5. Ops Review Center update (material changes, blockers, next actions)

Output format per check:
- status: GREEN/YELLOW/RED
- evidence: command/URL/marker
- owner
- blocker (if any)
- ETA
