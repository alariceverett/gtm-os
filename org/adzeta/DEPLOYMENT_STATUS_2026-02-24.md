# GTM OS v1 Deployment Status Report

**Date:** 2026-02-24  
**Branch:** `fix/heartbeat-ssh-protocol-guardrail-upstream` → `main`  
**Status:** GitHub Setup Complete ✅ | Vercel Blocked pending auth

---

## ✅ GitHub Setup Complete

### Repo Wiring
- [x] Default branch: `main`
- [x] Remote: `git@github.com:alariceverett/AlEverett.git` (SSH)
- [x] CODEOWNERS created (`* @alariceverett`)
- [x] PR template created with evidence-mode checklist

### Branch Protection (Blocked - needs Pro/public)
- Repo is private → Branch protection API requires GitHub Pro or public repo
- Manual setup required via GitHub web UI if needed:
  - Require PR before merge
  - Require status checks (CI workflow)
  - Require 1 approval
  - Dismiss stale approvals
  - Restrict force pushes

### CI Readiness ✅
- [x] GitHub Actions enabled
- [x] Updated workflow at `.github/workflows/ci.yml`
- [x] Node version pinned (`.nvmrc` → 22)
- [x] npm caching configured
- [x] Frontend-shell build step added
- [x] Committed: `b99add5` "chore(github): setup CODEOWNERS, PR template, CI workflow, .nvmrc"
- [x] Pushed to origin

### CI Run Status
```
Run ID: 22355910166 - completed failure (missing package-lock.json - fixed)
Run ID: NEW (pending) - should pass after package-lock.json commit
```

**Fix Applied:**
- Committed `apps/gtm-command-center/frontend-shell/package-lock.json` (commit `1b56cdb`)

---

## 🚫 Vercel Deployment Blocked

### Current Status
**Unable to complete Vercel setup - Authentication Required**

The Vercel CLI requires interactive OAuth flow (`vercel login`) which opens a browser. This is not supported in this headless environment.

### ✅ Verified - Ready to Deploy
- [x] Frontend-shell builds locally: **SUCCESS**
  - Next.js 15.1.6
  - 13 pages prerendered
  - Build output in `.next/`
- [x] Build command: `npm run build` (in `apps/gtm-command-center/frontend-shell/`)
- [x] Output directory: `.next/`
- [x] Framework: Next.js

### 🔄 Required: Manual Vercel Token Setup

**Option A: Set VERCEL_TOKEN Environment Variable**

1. Visit https://vercel.com/account/tokens
2. Create a new token (scope: "Full Account")
3. Set as environment variable:
   ```bash
   export VERCEL_TOKEN="your_token_here"
   ```

**Option B: Use Vercel CLI with Token**

Once token is available:
```bash
# Login with token
vercel login --token $VERCEL_TOKEN

# Link project
cd apps/gtm-command-center/frontend-shell
vercel link --scope alariceverett --project gtm-command-center

# Deploy
vercel --prod
```

### Environment Variables Required
Per `org/adzeta/VERCEL_SETUP_BASELINE.md`:

**Client-side (build-time):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Current .env.example contains:**
- `DATABASE_URL` (Supabase PostgreSQL)

**Note:** Frontend-shell uses Next.js, so variables should use `NEXT_PUBLIC_` prefix for client exposure.

---

## 📝 Evidence Capture

| Item | Status |
|------|--------|
| Default branch | `main` |
| Active workflows | `ci.yml` - gtm-command-center baseline checks |
| Branch protection | Manual (requires Pro/public) |
| CODEOWNERS | ✅ Created |
| PR Template | ✅ Created |
| .nvmrc | ✅ Created (v22) |
| CI node cache | ✅ Enabled |
| Build passes | ✅ Local success |
| Preview URL | 🚫 Blocked - needs Vercel auth |

---

## 🎯 Next Steps

### Immediate (Manual Required)
1. **Obtain Vercel token** from https://vercel.com/account/tokens
2. **Set `VERCEL_TOKEN` environment variable**
3. **Run subagent with Vercel auth** to complete deployment

### Once Token Available
1. Run `vercel login --token $VERCEL_TOKEN`
2. Link project: `vercel link`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`
5. Capture preview URL
6. Verify `/ops` dashboard loads

---

## 🔗 Links

- Repo: https://github.com/alariceverett/AlEverett
- PR: https://github.com/alariceverett/AlEverett/pull/new/fix/heartbeat-ssh-protocol-guardrail-upstream
- CI Runs: https://github.com/alariceverett/AlEverett/actions
