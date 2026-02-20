# Deployment Profile

Environment configuration contract for Forge apps.

## Environment Variables

| Variable | Required | Where | Example |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Vercel + local | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Vercel + local | `eyJ...` (public, safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Fns only | Vercel (server) | `eyJ...` (**never expose to client**) |
| `SUPABASE_DB_URL` | Migrations only | CI/CD + local | `postgresql://...` |

*`VITE_` prefix = exposed to browser. Only put public keys here.*

## Secrets Locations

| Secret | Location | Access |
|---|---|---|
| Supabase service role key | Vercel env vars (encrypted) | Server-side only |
| OAuth provider secrets | Supabase dashboard → Auth → Providers | Supabase managed |
| API keys (third-party) | Vercel env vars | Edge Functions only |
| Database password | Supabase dashboard → Settings → Database | Migration scripts only |

**Rule:** No secrets in code, no secrets in `.env` files committed to git. Use `.env.local` locally (gitignored).

## URLs

| Environment | URL | Purpose |
|---|---|---|
| **Local** | `http://localhost:5173` | Development |
| **Staging** | `https://{project}-git-{branch}.vercel.app` | Preview deploys (auto per PR) |
| **Production** | `https://{custom-domain}` | Live |
| **Supabase** | `https://{project-ref}.supabase.co` | API + Dashboard |

## Deploy Pipeline

```
git push → GitHub Actions → Build → Vercel Deploy
                ↓
          Type check + lint
                ↓
          Build (vite build)
                ↓
          Deploy to preview (branch) or production (main)
```

**Branch deploys:** Every push to a non-main branch gets a preview URL automatically.
**Production deploys:** Merge to `main` → auto-deploy to production.

## Rollback Policy

### Quick Rollback (< 5 min)
1. Vercel dashboard → Deployments → find last good deploy → "Promote to Production"
2. No code changes needed — instant rollback

### Database Rollback
- Supabase migrations are forward-only by default
- For schema rollbacks: write a new migration that reverses the change
- For data rollbacks: restore from Supabase daily backups (Pro plan) or point-in-time recovery

### When to Rollback
- Core workflow broken in production
- Auth flow broken
- Data corruption detected
- Performance degradation > 3x baseline

**Log every rollback** via [After-Action Template](../learning/AFTER_ACTION_TEMPLATE.md).

## Health Checks

After every deploy, verify:
- [ ] App loads (no white screen)
- [ ] Auth works (sign in/out)
- [ ] Core workflow completes
- [ ] No new console errors
- [ ] Supabase connection healthy
