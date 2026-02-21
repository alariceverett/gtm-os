# GTM Command Center (MVP)

Minimal local server for operator workflows.

## Environment setup

Copy `.env.example` to `.env` and set **one** of these:

### Option A: Direct Postgres (fallback)

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

### Option B: Supabase-first

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

> Never commit real keys. Keep only placeholders in git.

## Runtime selection (Supabase vs direct PG)

At startup, runtime mode is resolved in `lib/supabase-env.mjs`:

- `supabase` when Supabase env is valid (URL + anon key; service role preferred server-side)
- `pg` when Supabase env is incomplete but `DATABASE_URL` exists
- `none` when neither is configured

`server.mjs` will read/write `public.cc_operator_tasks` using:

- `@supabase/supabase-js` in `supabase` mode
- `pg` in `pg` mode

## Client factories

- Server factory: `lib/supabase-clients.mjs#createServerSupabaseClient()`
  - Uses service role key when present, otherwise anon key.
- Browser-safe factory pattern: `lib/supabase-clients.mjs#createBrowserSupabaseClient()`
  - Accepts only `url` + `anonKey` and never requires/uses service role key.

## Run setup task board UI

```bash
cd apps/gtm-command-center
npm start
# open http://localhost:3000/setup
```

The `/setup` page reads `public.cc_operator_tasks` (`id`, `title`, `status`, `priority`) and lets operators advance status:

`todo -> in_progress -> done`

## Persistent local service (macOS launchd)

Configured service:
- Label: `com.adzeta.gtm-command-center`
- Port: `1981`
- URL: `http://localhost:1981/setup`

Useful commands:

```bash
# status
launchctl print gui/$(id -u)/com.adzeta.gtm-command-center

# restart
launchctl kickstart -k gui/$(id -u)/com.adzeta.gtm-command-center

# stop
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.adzeta.gtm-command-center.plist

# start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.adzeta.gtm-command-center.plist
```

Logs:
- `apps/gtm-command-center/.run/service.out.log`
- `apps/gtm-command-center/.run/service.err.log`


`todo -> in_progress -> done`

## KPI script (existing)

```bash
cd apps/gtm-command-center
DATABASE_URL="..." npm run kpis
```
