# SWARM_QUALITY_STACK.md

## Purpose
Permanent operating stack for swarm-first execution with enterprise-quality output.

## Required Gates (all must pass)
1. **Golden-path regression gate**
   - Core flow test must pass each cycle.
2. **Design quality gate**
   - Enterprise UI checklist pass required before merge.
3. **Integration train gate**
   - Merges happen through designated integration owner.
4. **Pattern-library gate**
   - Shared tokens/components only; no ad-hoc style drift.
5. **Scenario gate**
   - Test first-time user, operator, exec, and edge-case scenarios.
6. **Outcome gate**
   - Every task maps to a KPI or explicit unblock.
7. **Proof gate**
   - Route truth table + visible diffs + 2-minute walkthrough.
8. **Demo/canary gate**
   - Repeatable dataset mode for QA and demos.

## Swarm Roles (permanent)
- Planner
- Builder lanes
- Integrator
- QA/Usability
- Design reviewer
- Release/Comms

## Completion Definition
A cycle is complete only when all 8 gates pass and operator-facing proof is published in `/ops` Review Center.

## Incident Rule
Any missed gate => `SWARM_GAP` incident + corrective task + upstream Forge note.
