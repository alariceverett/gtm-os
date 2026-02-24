# Strategy & Decisions — Top-of-Funnel GTM Command Center

Last updated: 2026-02-21
Scope: Adzeta top-of-funnel operating system (Strategy + V2 execution surfaces: Targeting, Relationships, Actions, Pilot, Ops + API-backed workflows)

## Objective, ICP, and Offer Ladder

### Objective
Build a repeatable, operator-led top-of-funnel motion that reliably converts qualified outbound activity into pilot-ready opportunities, with clear stage progression and measurable weekly throughput.

### ICP (Ideal Customer Profile)
Primary ICP:
- Growth-stage brands with meaningful paid media spend and clear demand-gen accountability
- Typical decision makers: VP Marketing / Growth Lead / Founder-operator
- Channel context: Meta + Google heavy teams that need faster pilot validation and tighter funnel feedback loops

Operational qualification guardrails (current):
- Qualification confidence captured at intake
- Pipeline stages actively managed (`qualified -> discovery -> pilot_candidate`)
- Target-account rubric weighting:
  - ICP fit: 40
  - Intent strength: 35
  - Reachability: 25

### Offer Ladder
1. **Entry Offer (TOF):** structured outbound sequence variants
   - direct offer
   - proof-first
   - pain-point
2. **Conversion Offer:** discovery call / scoped pilot conversation after positive reply routing
3. **Core Offer:** pilot execution handoff via pilot-candidate stage + team handoff queue
4. **Expansion Offer (implied):** lifecycle continuation through nurture triggers, client updates, and delivery reporting

---

## Now / Next / Later Roadmap

### Now (0–2 weeks)
- Stabilize top-of-funnel operator flow in production-like local runtime
- Keep Home funnel-first and Ops process-heavy split
- Enforce auth guardrails on write routes (operator/admin)
- Use readiness + workflow completeness as daily control surfaces
- Keep demo seed/reset flow reliable for Monday operating cadence

**Definition of done (Now):**
- Daily use: intake → enroll → classify → promote → handoff is executable without manual SQL
- API/UI markers present for TOF core workflow
- Monday readiness can be called and interpreted in <5 minutes

### Next (2–6 weeks)
- Add live alert-state engine (beyond static rules display)
- Tighten acquisition-to-revenue linking (reply quality to pilot conversion to delivery outcomes)
- Add stronger owner-by-lane accountability on operator tasks/handoff items
- Increase confidence in Supabase-mode KPI parity and remove placeholder logic

**Definition of done (Next):**
- Alerting produces actionable state changes with owner assignment
- Funnel stage movement and sequence performance are trendable week-over-week
- KPI parity confirmed across runtime modes

### Later (6+ weeks)
- Upgrade auth from local Basic to org-grade identity model (OIDC/session/JWT)
- Expand from top-of-funnel to full funnel operating model (retention/expansion instrumentation)
- Add predictive prioritization for qualified accounts and outreach sequencing

**Definition of done (Later):**
- Identity + audit meets production standards
- End-to-end funnel reporting includes TOF through downstream value realization
- Prioritization model measurably improves conversion efficiency

---

## Decision Log (with rationale)

| Date | Decision | Rationale | Owner | Status |
|---|---|---|---|---|
| 2026-02-21 | Keep **Home funnel-first** and move heavy execution controls to **Ops** | Reduces cognitive load on daily operators while preserving depth in Ops | Product/Ops | Active |
| 2026-02-21 | Make write actions auth-protected with local operator/admin RBAC | Prevents accidental/destructive local writes and creates clear authorization boundary | Platform | Active |
| 2026-02-21 | Standardize TOF sequence variants (direct-offer, proof-first, pain-point) | Enables controlled outbound testing without reinvention per campaign | Growth Ops | Active |
| 2026-02-21 | Add reply classification hook to route next actions + enrollment attempts | Speeds transition from inbound signal to explicit operator action | Growth Ops + Eng | Active |
| 2026-02-21 | Add qualified account pipeline stages and promotion endpoints | Makes pilot-readiness progression explicit and trackable | Sales/Ops | Active |
| 2026-02-21 | Maintain local-first architecture with Supabase/PG runtime fallback | Preserves velocity and resilience across environment constraints | Platform | Active |
| 2026-02-21 | Keep static alert rules first, defer live alert-state engine to Next | Ships usable observability quickly while containing scope | Platform | In progress |
| 2026-02-21 | Preserve Monday readiness + workflow completeness as operating gates | Creates shared go/no-go language for weekly execution | Ops Lead | Active |

---

## Owner & Status Snapshot (Execution)

| Workstream | Primary Owner | Current Status | Notes |
|---|---|---|---|
| TOF Intake + Qualification | Growth Ops | Active | Qualified account intake and rubric operational |
| Sequence Enrollment UX | Growth Ops + Eng | Active | Enrollment endpoints and template variants live |
| Reply Routing | Growth Ops + Eng | Active | Classification + next-action hooks operational |
| Pilot Handoff Lane | Sales/Ops | Active | Stage promotions and handoff queue available |
| Competitive Intel Ingest | Growth Ops | Active | Panel + ingest endpoint wired |
| Readiness & Completeness Gates | Ops Lead | Active | Monday readiness + workflow completeness exposed |
| Alert State Automation | Platform | In progress | Static config shipped; dynamic state pending |
| Runtime KPI Parity | Platform/Data | In progress | Supabase parity not fully complete |
| Identity Hardening | Platform/Security | Planned | OIDC/session model is later-phase migration |

---

## URL Markers

- `/docs/STRATEGY_AND_DECISIONS.md#objective-icp-and-offer-ladder`
- `/docs/STRATEGY_AND_DECISIONS.md#now--next--later-roadmap`
- `/docs/STRATEGY_AND_DECISIONS.md#decision-log-with-rationale`
- `/docs/STRATEGY_AND_DECISIONS.md#owner--status-snapshot-execution`
