# Setup Spin-Up Plan (Focused)

Goal: keep initial user burden minimal and get to deployable momentum fast.

## Focus areas
1. Local-first data capture (immediate)
2. Optional Supabase sync path
3. GitHub repo + auth + CI baseline
4. Optional Vercel deploy path

## User-required inputs only (minimal)
- Supabase keys/config (only if cloud sync is desired)
- GitHub account/repo access approval where needed
- Vercel account/team + project linkage approval (only if public deploy is desired)

## Agent-executable by default
- Local scaffolding and validation scripts
- GitHub issue/PR automation and branch hygiene
- Vercel config files and deployment readiness checks
- Progress tracking via DB + queue

## Ordered execution
1) Confirm priority + queue integrity
2) Initialize local DB capture path first (default)
3) Ensure DB-backed operator tasks exist in UI
4) GitHub setup pass (auth check, repo wiring, branch protections plan)
5) Optional Supabase sync pass (schema + migration/sync strategy)
6) Optional Vercel setup pass (project config, env map, deploy command)
7) End-to-end dry run: commit -> push -> local run (always), deploy (optional) -> verify

## Blocker policy
- If a task requires user secrets/account action, mark BLOCKED with owner=user and continue with next unblocked setup task.
