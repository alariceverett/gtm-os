# Rapid Command Center Recovery Plan (AdZeta)

## Problem
Time-to-usable Command Center is too slow. Current surface is operational but too sparse versus expected "full command center".

## 24-hour recovery objective
Deliver a materially complete local-first Command Center on :1981 with actionable operator workflows.

## Scope (must ship)
1. KPI dashboard panel (core metrics + deltas)
2. Execution board (Current/Blocked/Next/Done/Waiting-on-user)
3. Alerts + escalation panel
4. Deployment/health panel (local service + GitHub/Vercel readiness)
5. Operator actions (promote/block/unblock/complete)
6. Data freshness + activity timeline

## Phased delivery
- Phase A (now): Information architecture + UI skeleton with live data bindings
- Phase B: Action wiring + status transitions + guardrails
- Phase C: polish + verification + runbook

## Acceptance criteria
- Opening http://localhost:1981 shows a non-sparse, multi-panel command center
- Operator can manage tasks and see blockers without leaving the page
- At least 5 core KPIs and 8 alert rules visible
- Local-first mode works without Supabase/Vercel enabled
