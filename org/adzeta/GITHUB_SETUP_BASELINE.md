# AdZeta — GitHub Setup Baseline (Repo wiring + branch policy + CI readiness)

_Last updated: 2026-02-22_

## Goal
Ensure GitHub is configured to protect production velocity while keeping evidence-mode changes auditable.

## Repo wiring
- [ ] Default branch identified (usually `main`)
- [ ] Remote is set and reachable (SSH preferred)
- [ ] CODEOWNERS present for critical paths (ops/org/config)

## Branch protection (recommended)
For `main`:
- [ ] Require PR before merge
- [ ] Require status checks to pass (build/lint/test)
- [ ] Require at least 1 approval
- [ ] Dismiss stale approvals on new commits
- [ ] Restrict force pushes

## CI readiness checklist
- [ ] GitHub Actions enabled
- [ ] Minimal workflow exists: install → lint → test → build
- [ ] Cache configured (npm)
- [ ] Node version pinned (via `.nvmrc` or `engines`)

## Evidence-mode guardrails
- [ ] PR template includes: KPI mapping + acceptance criteria + verification steps
- [ ] Every merged PR references an evidence artifact or checklist run when relevant

## Outputs to capture (paste into ops log)
- Default branch name
- Active workflows list
- Branch protection summary (screenshots/notes)
