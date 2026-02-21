# Setup Spin-Up Plan (Focused)

Goal: keep initial user burden minimal and get to deployable momentum fast.

## Focus areas
1. Supabase connectivity + task board loop
2. GitHub repo + auth + CI baseline
3. Vercel project + env sync + first deploy

## User-required inputs only (minimal)
- Supabase keys/config (when ready)
- GitHub account/repo access approval where needed
- Vercel account/team + project linkage approval

## Agent-executable by default
- Local scaffolding and validation scripts
- GitHub issue/PR automation and branch hygiene
- Vercel config files and deployment readiness checks
- Progress tracking via DB + queue

## Ordered execution
1) Confirm priority + queue integrity
2) Ensure DB-backed operator tasks exist in UI
3) GitHub setup pass (auth check, repo wiring, branch protections plan)
4) Vercel setup pass (project config, env map, deploy command)
5) End-to-end dry run: commit -> push -> deploy -> verify

## Blocker policy
- If a task requires user secrets/account action, mark BLOCKED with owner=user and continue with next unblocked setup task.
