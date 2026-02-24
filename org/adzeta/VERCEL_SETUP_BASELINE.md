# AdZeta — Vercel Setup Baseline (Project link + env map + first deploy runbook)

_Last updated: 2026-02-22_

## Goal
Get a reliable deploy surface (preview + production) that supports the evidence loop: `/`, `/ops`, `/research`, and read APIs.

## Project linkage checklist
- [ ] Vercel project connected to GitHub repo
- [ ] Framework preset matches app (Vite/Next/etc.)
- [ ] Build command and output dir verified
- [ ] Preview deployments enabled on PRs

## Environment variable map (minimum)
Client (safe to expose):
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`

Server-only (never client):
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (only if server-side writes/edge functions are used)

## First deploy runbook
1) Merge a small “no-op” PR to confirm pipeline.
2) Confirm preview deploy succeeds and loads `/`.
3) Promote to production.
4) Run `org/adzeta/DEPLOYMENT_VERIFICATION_CHECKLIST.md`.

## Evidence capture
- Deployment URL(s): preview + prod
- Screenshot of `/ops` KPI scoreboard
- Timestamp of deploy and smoke check results
