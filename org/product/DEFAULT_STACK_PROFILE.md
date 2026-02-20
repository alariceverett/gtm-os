# Default Stack Profile

Opinionated defaults for new apps. Use these unless you have a reason not to.

## The Stack

| Layer | Default | Why |
|---|---|---|
| **Frontend** | React + Vite | Fast builds, huge ecosystem, AI-friendly |
| **Styling** | Tailwind CSS | Utility-first, no context-switching |
| **State** | Zustand | Minimal boilerplate, works with React |
| **Backend/DB** | Supabase (Postgres) | Auth + DB + Storage + Realtime in one |
| **Auth** | Supabase Auth | Email/password + OAuth, RLS integration |
| **Storage** | Supabase Storage | File uploads with RLS policies |
| **Deployment** | Vercel | Zero-config for Vite/React, preview deploys |
| **CI/CD** | GitHub Actions | Comes free with GitHub repos |

## Scaffold Command

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install @supabase/supabase-js zustand
npm install -D tailwindcss @tailwindcss/vite
```

## How to Swap Each Layer

### Frontend → Next.js / Astro / SvelteKit
- Update `DEPLOYMENT_PROFILE.md` build command
- Supabase client works the same (JS SDK)
- Adjust Vercel framework preset

### Styling → CSS Modules / Styled Components / shadcn
- Remove Tailwind from config
- No other changes needed

### State → Redux Toolkit / Jotai / React Query
- Replace Zustand stores with equivalent
- No backend impact

### Backend → Custom API (Express/Hono/Fastify)
- Deploy API separately (Vercel serverless or Railway)
- Replace Supabase client calls with fetch/axios
- Handle auth separately (JWT, session, etc.)

### Database → PlanetScale / Neon / Turso
- Update connection strings in DEPLOYMENT_PROFILE
- Replace Supabase client with appropriate ORM (Drizzle/Prisma)
- Lose Supabase Auth + RLS — handle separately

### Deployment → Railway / Fly.io / Cloudflare Pages
- Update CI/CD pipeline
- Adjust env var configuration
- Update DEPLOYMENT_PROFILE URLs

## When to Deviate

Use the [Decision Framework](../DECISION_FRAMEWORK.md) to log why you're swapping a default. Common valid reasons:
- Team already knows a different stack
- Specific technical requirement (e.g., SSR → Next.js)
- Cost constraints
- Existing infrastructure

**Not a valid reason:** "I prefer X." Preferences are fine for personal projects. For Forge apps, pick defaults unless there's a functional reason.
