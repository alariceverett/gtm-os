# AdZeta — Deployment Verification Checklist (GTM stack)

_Last updated: 2026-02-22_

## Purpose
A proof-first checklist to verify that deploys do not break the evidence loop (events → KPIs → operator action).

## Pre-deploy (CI + sanity)
- [ ] `npm test` (or equivalent) passes
- [ ] `npm run lint` passes
- [ ] Build succeeds locally: `npm run build`
- [ ] No secrets committed (run secret scan if available)

## Environment mapping (Vercel)
- [ ] `VITE_SUPABASE_URL` present (client)
- [ ] `VITE_SUPABASE_ANON_KEY` present (client)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present only where server-side is used (never client)
- [ ] Preview vs Production env vars verified

## Post-deploy smoke checks (UI)
Routes must load without console errors:
- [ ] `/` (comms-first)
- [ ] `/ops` (scoreboard + evidence feed)
- [ ] `/research` (research ledger)

## Post-deploy smoke checks (API)
- [ ] `GET /api/research-ledger` returns `200` and non-empty array (or empty with schema-correct shape)
- [ ] Any `/api/events` read path returns schema-correct payload (if implemented)

## Proof markers
- [ ] Page contains stable `data-verify` markers for core surfaces
- [ ] `relationship-intelligence-handoff-verify-v1` script still passes (if present)

## Regression gates (evidence mode)
- [ ] Can add a ledger entry and view it in UI
- [ ] Can create/record an event with `evidence_ref`
- [ ] `/ops` shows the 4 canonical KPIs (even if 0)

## Rollback plan
- [ ] Identify last known good deployment
- [ ] Promote previous deployment to production (Vercel)
- [ ] Open incident note with timestamps + failing check + suspected cause
