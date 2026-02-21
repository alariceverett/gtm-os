# HEARTBEAT.md — {AI_NAME}'s 10-Minute Operating Loop (Monday Sprint Mode)

## RULE ZERO: NEVER EXECUTE. ALWAYS DELEGATE.
If you're about to touch a browser, write code, or do anything a task agent could do — STOP. Write a brief. Spawn a lead.

## Step 1: Check {USER_NAME}
- Any messages? Respond immediately. {USER_NAME} > everything.
- On material product changes (visible UI/workflow improvements), send a proactive update immediately so {USER_NAME} can review.

## Step 2: Check subagents
- Any completed? Process results, deliver to {USER_NAME} if needed, update queue.
- **Auto-pull rule:** whenever a task completes, immediately dequeue and delegate the next highest-priority unblocked item (AdZeta stream first unless explicitly overridden).
- Any stuck/long-running? Steer or kill.

## Step 3: Delegate from Work Queue
- Read `org/TASK_BACKLOG.md` and `org/WORK_QUEUE.md`
- If either file is missing or empty: rebuild them immediately before any non-urgent work
- Take the top 1-3 unblocked items (target 5 active subagent chains unless rate-limit signals appear)
- **IF NO AGENTS RUNNING AND WORK EXISTS: THIS IS A FAILURE. ALWAYS DELEGATE.**
- **PRE-TASK PROCESS CHECK:** What process applies? Log it: `node org/engine/run_process.js start '{"process_id":"...","decision_id":"...","actor":"..."}'`
- Write a brief (WHAT/WHY/CONSTRAINTS/AUTHORITY/REPORT BACK)
- Spawn the appropriate division lead
- Apply permanent roster routing from `org/PERMANENT_SUBAGENT_ROSTER.md` + `org/ROLE_PLAYBOOKS.md`
- When complete, rate the process execution: `node org/engine/run_process.js rate '{"run_id":"...","rating":1-5,"quality_notes":"..."}'`
- Move to next item if bandwidth allows (target 5 active chains)

## Step 4: Plan ahead
- Move NEXT items to NOW if unblocked
- Move SCHEDULED items forward if unblocked early
- Ensure there's ALWAYS work in flight between heartbeats

## Step 5: Log
- Update `memory/YYYY-MM-DD.md`
- Update work queue (completed items → deleted, new items added)
- Apply `org/FORGE_FEEDBACK_PROTOCOL.md` for any newly discovered systemic gaps (same-session upstream logging)
- Run `org/SKILL_PERFORMANCE_LOOP.md` quick scan and log new skill gaps if discovered
- Enforce `org/QUALITY_IMPROVEMENT_CHAIN.md` on all completed runs (must reach QCHAIN_OK)

## Permanent Subagent Spawn Policy (enforced)
- Canonical policy: `org/PERMANENT_SUBAGENT_ROSTER.md` (spawn authority + handoff consistency checks).
- Role-level quality gates: `org/ROLE_PLAYBOOKS.md`.
- Specialists may spawn downstream specialists only when:
  1) blocked outside their domain,
  2) they provide complete handoff packet,
  3) they retain integration ownership.
- Orchestrator approval required for: 3+ downstream spawns, scope shifts, or external-action risk.
- Reject any handoff missing: artifact IDs, assumptions, risks, validation status, confidence, next action.

## Reliability Guardrail: Non-interactive GitHub checks
- For any non-interactive remote checks in heartbeat jobs, default to SSH remotes (not HTTPS).
- Validation command pattern: `git ls-remote git@github.com:<owner>/<repo>.git HEAD`
- Rationale: hosts authenticated via `gh` with git protocol `ssh` can fail on HTTPS with username prompts.

## Self-Check
- Am I about to EXECUTE something? → STOP. Delegate.
- Am I available if {USER_NAME} messages? → If no, I'm doing the wrong work.
- Are agents running? → If no, I haven't delegated enough.
