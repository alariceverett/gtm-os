# Monday Readiness Gap Audit (P0/P1/P2)

## P0 (must close before Monday launch)
1. CI pipeline baseline (lint/test/smoke)
2. Formal migration/versioning workflow (ordered migrations + verification)
3. Evented autopull runner (not heartbeat-dependent)
4. Monday go/no-go checklist with explicit pass/fail gates
5. Backup/restore sanity check for core GTM tables

## P1 (high priority, next 1-2 weeks)
1. Break up monolithic `server.mjs` into modules (routes/services/data)
2. Basic auth/RBAC boundary for operator actions
3. Durable async jobs for sequence/lifecycle processing
4. Structured observability: health metrics + error budget + alerting

## P2 (important, next 2-4 weeks)
1. Throughput autotuner for worker concurrency
2. Configurable GTM module templates by vertical
3. Cloud sync/deploy adapters hardening (Supabase/Vercel profiles)

## Notes
- Local-first must remain first-class.
- Cloud modules should remain optional.
- Command center should expose readiness stage: Skeleton / Usable / Production-ready.
