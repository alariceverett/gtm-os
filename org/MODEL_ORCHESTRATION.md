# MODEL_ORCHESTRATION.md

## Goal
Use the right model lane for each task type to improve quality and speed.

## Lanes
1) **Execution Lane**
- Purpose: coding, wiring, scripts, integration, bugfixes
- Default: fast coding model

2) **Strategy Lane**
- Purpose: prioritization, roadmap, tradeoffs, market framing
- Default: higher-deliberation reasoning model

3) **Design Critic Lane**
- Purpose: UX/UI critique, hierarchy/copy/interaction coherence, enterprise polish gating
- Default: model optimized for design/product judgment

4) **QA Gate Lane**
- Purpose: deterministic pass/fail checks, route truth, golden-path replay, regression checks
- Default: reliability-focused checker lane

5) **Release/Comms Lane**
- Purpose: operator-facing proof packs, concise updates, review-burst generation
- Default: concise synthesis model

## Routing Rules
- Every task must declare lane at spawn.
- Every spawn must set explicit `model` using `org/MODEL_LANE_MAPPING.json`.
- No UI merge without Design Critic + QA Gate pass.
- No strategy decisions without Strategy Lane review.
- No release update without Proof Gate evidence.
- /ops must show lane -> model mapping for active runs.

## Escalation Rules
- If design score declines 2 cycles: force Design Critic lane on all UI changes.
- If golden path fails: freeze feature expansion and run QA Gate + Execution hotfix only.
- If confidence low: route to human review burst.

## Minimum per-cycle orchestration
- 1 strategy review
- 1 design critic pass (for UI-affecting changes)
- 1 QA gate pass
- 1 operator proof pack
