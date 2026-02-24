# GTM Command Center Frontend Shell (Phase-1)

Non-breaking Next.js app-shell bootstrap for frontend migration.

## Why this exists
- Keep existing `server.mjs` app running unchanged on `:1981`.
- Build modern frontend incrementally in parallel.
- Reuse existing API surface during migration.

## Run

```bash
# terminal 1: legacy backend
cd ../
npm start

# terminal 2: frontend shell
cd frontend-shell
npm install
npm run dev
```

Open: `http://127.0.0.1:3001`

By default, the shell reads backend data from:
- `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:1981`

## Included route scaffolds
- `/`
- `/ops` (example live fetch from `/api/metrics/snapshot`)
- `/targeting`
- `/actions`
- `/relationships`
- `/comms`
- `/pilot`
- `/research`
- `/strategy`

## Phase-1 guardrails
- No legacy route replacement yet.
- No destructive backend changes.
- Route migration is additive until parity + tests are complete.
