# OBJECTIVES.md — AdZeta GTM Operating Objectives

_Last updated: 2026-02-22_

## Mission
Build and operate an enterprise-grade GTM operating layer on top of the existing AdZeta product so AI handles background research/outreach/nurture execution and the human team handles high-leverage human conversations.

## Primary Outcome (Current Sprint)
Move qualified beauty brands ($500K+ annual ad spend) from cold outreach into pilot pipeline with clear visibility, strong UX clarity, and reliable execution.

## 30-Day Objectives
1. Launch a clear, intuitive GTM command interface (Home, Targeting, Actions, Relationships, Pilot, Ops).
2. Establish AI-led relationship engine with account/individual views and research transparency.
3. Increase qualified funnel entries and handoff-ready opportunities.
4. Enforce reliability + quality gates so no silent regressions.

## Weekly Targets (Current)
- Ship usable golden flow: Targeting → Actions → Relationships → Pilot.
- Reach enterprise-grade UX baseline (clarity in <30s, core flow <=5 clicks).
- Stand up Communications + Intelligence layers (account/individual + next-best-action scoring).
- Keep active execution at capacity (current platform cap: 5).

## Non-Negotiable Product Principles
1. **Operator-light input**: user gives target/segment; system does heavy lifting.
2. **Business clarity first**: Home is business-facing; Ops is separate.
3. **Actionability over dashboards**: every view must answer “what next?”.
4. **AI transparency**: show what research was done and why targets are recommended.
5. **Human leverage**: system prepares and nurtures; humans handle key relationship moments.

## Not Doing (for now)
- Rebuilding core AdZeta product from scratch.
- Adding complex multi-field setup forms as primary flow.
- Shipping internal/process noise on business-facing pages.

## Objective → Execution Mapping
- **Objective 1 (UI clarity)** → V2 route and IA work (`/`, `/targeting`, `/actions`, `/relationships`, `/pilot`, `/ops`, `/strategy`).
- **Objective 2 (Intelligence)** → Comms account/individual views, research ledger, relationship scoring, segment recommender.
- **Objective 3 (Funnel growth)** → qualification snapshot, sequence placement, handoff queue, pilot progression.
- **Objective 4 (Reliability)** → quality chain, worker-floor enforcement, route health checks, smoke tests.

## Success Criteria (Go/No-Go)
- New user can explain product purpose in one sentence within 30 seconds.
- Team can execute core flow in <=5 clicks without assistance.
- All critical routes return HTTP 200 consistently.
- Relationship intelligence recommends next actions with rationale.
- Home clearly shows outreach/pipeline health and “needs human action now.”
