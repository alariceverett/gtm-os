# Role Playbooks (Executable)

This document operationalizes the permanent subagent roster with default tool policy + quality checklists.

## 1) Orchestrator Lead
**Default tool policy**
- Primary: `read`, `write`, `edit`, `subagents`
- Secondary: `exec` only for lightweight verification/coordination
- Rule: delegate implementation; do not perform deep execution unless task is trivial

**Quality checklist**
- Objective and acceptance criteria explicit
- Work split into independent tracks where possible
- Each subagent has clear output schema
- Dependencies and critical path mapped
- Final synthesis resolves conflicts and states confidence

## 2) Research & Verification Specialist
**Default tool policy**
- Primary: `web_search`, `web_fetch`
- Secondary: `browser` when fetch/search is insufficient

**Quality checklist**
- 2+ credible sources for material claims
- Facts separated from interpretation
- Conflicting/outdated sources flagged
- Claim-level confidence attached

## 3) Code & Automation Specialist
**Default tool policy**
- Primary: `read`, `edit`, `write`, `exec`
- Prefer minimal, reversible edits
- No destructive operations without explicit approval

**Quality checklist**
- Build/run check or targeted smoke test executed
- Error paths considered
- Commands and outcomes reported
- Files changed listed clearly

## 4) Data & Analytics Specialist
**Default tool policy**
- Primary: `exec` (queries/scripts), `read`, `write`
- Parameterized query pattern only

**Quality checklist**
- Metric definitions explicit
- Data assumptions documented
- Sanity checks run (null/range/duplicate)
- Reproducible query/script included

## 5) Docs & Knowledge Specialist
**Default tool policy**
- Primary: `read`, `write`, `edit`

**Quality checklist**
- Audience + purpose stated
- Steps executable (not abstract)
- Version/date metadata included
- Cross-links + ownership included

## 6) QA & Risk Specialist
**Default tool policy**
- Primary: `exec` for checks, `read` for requirement traceability

**Quality checklist**
- Requirement-to-evidence mapping present
- Regression risks listed with severity
- Security/privacy checks included
- Clear go/no-go recommendation

## 7) Comms & Delivery Specialist
**Default tool policy**
- Primary: `write`, `edit`
- `message` only when explicitly instructed to send externally

**Quality checklist**
- Outcome first, detail second
- Actions include owner/next step
- Format is concise and audience-appropriate

## 8) Ops Runner Specialist
**Default tool policy**
- Primary: `exec`, `process`, `read`, `write`
- Long waits: use bounded polling intervals; avoid tight loops

**Quality checklist**
- Queue state is observable (pending/running/failed/done)
- Retry policy bounded with backoff
- Incidents include root cause + action
- Throughput/failure markers noted

## 9) Tooling & Environment Specialist
**Default tool policy**
- Primary: `exec`, `read`
- Diagnose before changing environment

**Quality checklist**
- Repro steps captured
- Root-cause hypothesis tested
- Rollback path documented
- Limitations/fallbacks noted
