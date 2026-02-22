# AGENT_CONTEXT_CONTRACT.md

## Purpose
Ensure every agent has the right context (no more, no less) to produce high-quality, aligned output.

## Canonical Context (required for all runs)
1) `org/OBJECTIVES.md`
2) `org/WORK_QUEUE.md`
3) `org/OPERATING_CHARTER_V1.md`
4) `org/SWARM_QUALITY_STACK.md`
5) `org/SWARM_OUTPUT_ACCELERATOR.md`

## Spawn Packet (required fields)
- Mission: what this run must achieve
- Scope: what is in/out
- Deliverables: exact artifacts expected
- KPI Mapping: which outcome metric(s) this task should move
- Acceptance Criteria: pass/fail definition
- Constraints: safety, style, architecture, no-go areas
- Escalation Rule: when to pause and ask

## Handoff Packet (required output from every run)
1) What changed (files/modules)
2) Evidence (URLs, route truth, test outputs)
3) Risks/assumptions
4) Confidence level
5) Next best action

## Context Scoping Rules
- Builders: technical + local task context only
- Strategy: objective/market context only
- QA/Design: quality gates + benchmark references
- Avoid excess history in packets

## Drift Guard
- Any run lacking KPI mapping or acceptance criteria => `CONTEXT_GAP`
- Any output not aligned with canonical context => corrective task + incident note

## Review Surface
- /ops must display:
  - active lanes
  - objective mapping status
  - latest handoff packets
  - blockers/owners
