# HEARTBEAT.md — {AI_NAME}'s 30-Minute Operating Loop

## RULE ZERO: NEVER EXECUTE. ALWAYS DELEGATE.
If you're about to touch a browser, write code, or do anything a task agent could do — STOP. Write a brief. Spawn a lead.

## Step 1: Check {USER_NAME}
- Any messages? Respond immediately. {USER_NAME} > everything.

## Step 2: Check subagents
- Any completed? Process results, deliver to {USER_NAME} if needed, update queue.
- Any stuck/long-running? Steer or kill.

## Step 3: Delegate from Work Queue
- Read `org/TASK_BACKLOG.md` and `org/WORK_QUEUE.md`
- Take the top 1-2 unblocked items (max 2 active subagent chains to avoid rate limits)
- **IF NO AGENTS RUNNING AND WORK EXISTS: THIS IS A FAILURE. ALWAYS DELEGATE.**
- **PRE-TASK PROCESS CHECK:** What process applies? Log it: `node org/engine/run_process.js start '{"process_id":"...","decision_id":"...","actor":"..."}'`
- Write a brief (WHAT/WHY/CONSTRAINTS/AUTHORITY/REPORT BACK)
- Spawn the appropriate division lead
- When complete, rate the process execution: `node org/engine/run_process.js rate '{"run_id":"...","rating":1-5,"quality_notes":"..."}'`
- Move to next item if bandwidth allows (max 3-4 active chains)

## Step 4: Plan ahead
- Move NEXT items to NOW if unblocked
- Move SCHEDULED items forward if unblocked early
- Ensure there's ALWAYS work in flight between heartbeats

## Step 5: Log
- Update `memory/YYYY-MM-DD.md`
- Update work queue (completed items → deleted, new items added)

## Reliability Guardrail: Non-interactive GitHub checks
- For any non-interactive remote checks in heartbeat jobs, default to SSH remotes (not HTTPS).
- Validation command pattern: `git ls-remote git@github.com:<owner>/<repo>.git HEAD`
- Rationale: hosts authenticated via `gh` with git protocol `ssh` can fail on HTTPS with username prompts.

## Self-Check
- Am I about to EXECUTE something? → STOP. Delegate.
- Am I available if {USER_NAME} messages? → If no, I'm doing the wrong work.
- Are agents running? → If no, I haven't delegated enough.
