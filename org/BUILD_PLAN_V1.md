# Build Plan v1 — AdZeta GTM Command Center

## Objective
Deliver a demo-ready vertical slice that proves weekly GTM operating value.

## Stack (default)
- Frontend: Next.js (App Router)
- Auth/DB: Supabase
- Hosting: Vercel
- Telemetry/ops: Forge decision/process logging

## Milestone 1 (Vertical Slice)
1. Auth gate (Supabase)
2. Overview page with KPI cards
3. Pipeline health table (sample + seeded data)
4. Weekly brief draft panel
5. Deploy to Vercel + verify endpoints

## Milestone 2 (Operator Value)
1. Deal risk scoring rules
2. Action owner assignment + due dates
3. Weekly export/share format

## Milestone 3 (Scale readiness)
1. CRM integration adapter (deferred until source selected)
2. Role-based access tightening
3. Forecast model calibration

## Immediate Tasks (this week)
- Scaffold app repository and base routes
- Create Supabase schema for opportunities, stages, actions, weekly_briefs
- Implement milestone 1 vertical slice
- Deploy staging and run verification skill

## Success Criteria
- CRO can review pipeline status in <5 minutes
- Weekly brief generated in one pass with actionable priorities
- Demo feels polished and clearly better than ad-hoc spreadsheet workflow
