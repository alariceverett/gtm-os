# Permanent Subagent Roster (AdZeta)

_Source basis: completed run `5bddc7c4` (org design lead output), wired into executable operating process._

## Roster Table

| Role | Type | Core Responsibilities | Spawn Triggers | Primary Outputs |
|---|---|---|---|---|
| Orchestrator Lead | Lead | Intake, decomposition, routing, dependency graph, final synthesis | Any request with 3+ steps, cross-domain work, or external deadline | Workplan, assignment map, merged deliverable |
| Research & Verification Specialist | Specialist | Research, source validation, fact checks, confidence scoring | Claims needing evidence, “latest info”, market/tech scan | Source pack, verified findings, confidence notes |
| Code & Automation Specialist | Specialist | Code/scripts, refactors, debugging, test execution | File/repo changes, automation needs, bugfix requests | Diffs, test results, implementation notes |
| Data & Analytics Specialist | Specialist | SQL/data QA, metric definitions, reporting logic | KPI disputes, reporting asks, dataset reconciliation | Query outputs, metric definitions, anomaly summary |
| Docs & Knowledge Specialist | Specialist | SOPs/playbooks/changelogs and process docs | “Document this”, onboarding, policy/process gaps | Structured docs, decision logs, update proposals |
| QA & Risk Specialist | Specialist | Requirement traceability, edge-case testing, safety checks | High-impact changes, ambiguity, release readiness | QA report, risk register, go/no-go recommendation |
| Comms & Delivery Specialist | Specialist | Final packaging for stakeholder/user readability | Final delivery stage, status updates, multi-audience output | Executive summary, concise delivery artifact |
| Ops Runner Specialist | Specialist | Queue execution, autopull monitoring, retries, idempotency checks | Batch/queued/long-running or flaky tasks | Queue status digest, retry actions, incident notes |
| Tooling & Environment Specialist | Specialist | Diagnose and resolve tool/runtime/env blockers | Tool failures, environment drift, host mismatch | Tool plan, remediation notes, rollback/fallback |

## Downstream Spawn Authority (Specialists spawning specialists)

Specialists may spawn downstream specialists **only** when all conditions are true:
1. Parent specialist has exhausted direct progress within their domain.
2. Spawned task is narrow, testable, and blocked on another specialty.
3. Parent includes full handoff packet (artifact, assumptions, risks, done definition).
4. Parent remains accountable for integration and final quality.

### Allowed paths
- Code & Automation → QA & Risk (validation gate), Tooling & Environment (blocked runtime)
- Data & Analytics → QA & Risk (metric validation), Code & Automation (data script helper)
- Research & Verification → Docs & Knowledge (packaging), QA & Risk (claim sensitivity)
- Ops Runner → Tooling & Environment (runner failures), QA & Risk (incident severity)
- Docs & Knowledge → Comms & Delivery (final audience shaping)

### Disallowed paths (require Orchestrator approval)
- Any specialist spawning **3+** downstream specialists
- Any spawn adding external action risk (email/post/purchase)
- Any spawn that changes scope from implementation to strategy

## Consistency Checks for Quality Handoffs

Each handoff must include this schema (required):
- **Artifact ID(s):** file paths / commit refs / query IDs
- **Done Definition Check:** pass/fail against requested output schema
- **Assumptions:** explicit, numbered
- **Open Risks:** with severity (Low/Med/High)
- **Validation Status:** pass / partial / fail with evidence
- **Confidence:** High / Medium / Low
- **Requested Next Action:** single clear owner/action

A receiving agent must reject handoff as incomplete if any required field is missing.

## Activation Order (recommended immediate roles)
1. **Orchestrator Lead** (`orchestrator`) — central routing and dependency management.
2. **Code & Automation Specialist** (`claude-code`) — highest throughput for current AdZeta implementation backlog.
3. **QA & Risk Specialist** (`qa-risk`) — prevents regressions and enforces release-quality handoffs.

## Agent ID Mapping

See `SYSTEM_AGENT_REGISTRY.md` for OpenClaw agent IDs mapped to each roster role.

**Active Agents:**
- `orchestrator` — Orchestrator Lead
- `research` — Research & Verification
- `claude-code` — Code & Automation
- `data-analytics` — Data & Analytics
- `docs-knowledge` — Docs & Knowledge
- `qa-risk` — QA & Risk
- `comms-delivery` — Comms & Delivery
- `ops-runner` — Ops Runner
- `tooling-env` — Tooling & Environment

## Quick Reference: Spawn Pattern

```bash
# Spawn with Kimi via API
sessions_spawn: {
  "agentId": "AGENT_NAME",
  "model": "ollama/kimi-k2.5:cloud",
  "mode": "run" | "session",
  "task": "...",
  "label": "unique-id",
  "thread": true
}
```
