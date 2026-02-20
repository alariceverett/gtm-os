# Build Plan Template

Generated from intake. Every section has a default — override only what's wrong.

---

## Project: `{PROJECT_NAME}`

**One-liner:** {What does this app do, for whom?}

## Milestones

| # | Milestone | Default Duration | Deliverable |
|---|---|---|---|
| 1 | Scaffold + Auth | 1 session | Deployed skeleton with login |
| 2 | Vertical Slice | 1-2 sessions | Core workflow end-to-end |
| 3 | Remaining Screens | 2-3 sessions | All routes functional |
| 4 | Polish + Edge Cases | 1 session | Error states, loading, empty states |
| 5 | Production Deploy | 1 session | Live with monitoring |

*Default: 5 milestones, ~6-8 sessions total. Adjust based on scope.*

## System Boundaries

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser    │────▶│   Vercel     │────▶│  Supabase   │
│  (React/Vite)│     │  (Static +   │     │  (DB/Auth/  │
│              │     │   Edge Fn)   │     │   Storage)  │
└─────────────┘     └──────────────┘     └─────────────┘
```

**Default:** No separate API server. Supabase client talks directly from browser. Edge functions for anything that needs server-side logic.

*Override if:* You need a persistent backend process, WebSocket server, or heavy compute.

## Schema Draft

```sql
-- Default: Users come from Supabase Auth (auth.users)
-- Add app-specific tables here

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- {CORE_ENTITY}: The main thing users create/manage
CREATE TABLE {core_entity} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users see only their own data (default)
ALTER TABLE {core_entity} ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own {core_entity}"
  ON {core_entity} FOR ALL
  USING (auth.uid() = user_id);
```

## API Surface

| Endpoint / Query | Method | Default |
|---|---|---|
| Auth (sign up/in/out) | Supabase Auth SDK | Built-in |
| List {core_entity} | `supabase.from().select()` | Client-side |
| Create {core_entity} | `supabase.from().insert()` | Client-side |
| Update {core_entity} | `supabase.from().update()` | Client-side |
| Delete {core_entity} | `supabase.from().delete()` | Client-side |
| {Complex operation} | Edge Function | Server-side |

*Default: No REST API. Supabase client SDK handles CRUD. Add Edge Functions only for logic that can't run in the browser (secrets, multi-table transactions, external API calls).*

## UI Routes & Components

| Route | Component | Purpose | Default |
|---|---|---|---|
| `/` | `LandingPage` | Marketing / entry | Simple hero + CTA |
| `/login` | `AuthPage` | Sign in / sign up | Supabase Auth UI |
| `/dashboard` | `Dashboard` | Main app screen | List of {core_entity} |
| `/dashboard/:id` | `DetailView` | Single item | View + edit |
| `/settings` | `Settings` | Profile + prefs | Name, email, logout |

*Default: 5 routes. Add more as needed.*

## Test Strategy

| Level | Default | Tool |
|---|---|---|
| **Manual smoke test** | Every deploy | Checklist in APP_BOOTSTRAP.md |
| **Type checking** | Always | TypeScript strict mode |
| **Unit tests** | Critical logic only | Vitest |
| **E2E tests** | Core workflow only | Playwright (add in milestone 4) |
| **RLS tests** | Every table | SQL test queries as different roles |

*Default: Lean testing. Types + smoke tests + RLS verification. Add E2E for the happy path before production.*

## Deploy Checklist

- [ ] Env vars set per [DEPLOYMENT_PROFILE.md](./DEPLOYMENT_PROFILE.md)
- [ ] Supabase migrations applied
- [ ] RLS policies verified
- [ ] Build passes (`npm run build`)
- [ ] Preview deploy reviewed
- [ ] Core workflow tested on preview
- [ ] DNS / custom domain configured (production only)
- [ ] Error tracking enabled (Sentry or similar)
- [ ] Security checklist passed (see [Security Checklist](../security/SECURITY_CHECKLIST.md))
