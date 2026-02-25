# Production Deployment Verification Process

## Purpose
Ensure every production deployment is verified, issues are addressed, and redeploys happen automatically when needed.

## Trigger
New commit pushed to `main` branch → GitHub webhook → Vercel deployment

## Phase 1: Deploy (Automated)
1. GitHub push triggers Vercel build
2. Vercel builds and deploys to production
3. Vercel provides deployment URL

## Phase 2: Verify (Automated + Manual)

### Automated Smoke Tests (5 minutes post-deploy)
```bash
# Test critical endpoints
GET /api/command-center/kpis      → 200 + valid JSON
GET /api/predictions/anomalies    → 200 + valid JSON
GET /api/predictions/risks        → 200 + valid JSON
GET /api/feedback                 → 200 (OPTIONS preflight works)
POST /api/feedback                → 200 + {success: true}

# Test static assets
GET /                             → 200, HTML loads
GET /favicon.ico or /icon.svg     → 200
GET /_next/static/*               → 200 (JS bundles load)
```

### Production Console Check (Manual - 2 minutes)
Open browser DevTools on production URL:
- [ ] No 404 errors
- [ ] No `date.getTime is not a function`
- [ ] No `PGRST204` or `42501` errors
- [ ] Feedback POST returns 200

### Visual Regression (Manual - 2 minutes)
- [ ] Dashboard loads without blank cards
- [ ] KPI cards show data
- [ ] Dark mode toggle works
- [ ] No console red errors

## Phase 3: Decision Gate

### If ALL tests pass:
→ DEPLOYMENT VERIFIED
→ Log success in `memory/YYYY-MM-DD.md`
→ Monitor for 24 hours

### If ANY test fails:
→ INITIATE FIX PROTOCOL

#### Severity Assessment
| Severity | Criteria | Action |
|----------|----------|--------|
| CRITICAL | Site down, 500 errors, blank page | Immediate rollback + hotfix |
| HIGH | API errors break core features | Fix within 2 hours + redeploy |
| MEDIUM | Minor console errors, non-breaking | Fix in next planned push |
| LOW | Favicon missing, cosmetic issues | Add to backlog |

#### Fix Protocol
1. **Diagnose:** Reproduce issue locally
2. **Fix:** Apply code fix
3. **Test:** Verify locally
4. **Commit:** Push to `main`
5. **Redeploy:** Vercel auto-deploys
6. **Re-verify:** Run Phase 2 again
7. **Repeat until verified**

## Phase 4: Rollback (Emergency Only)

If critical failure and fix will take >30 minutes:
```bash
# Rollback to last known good commit
git log --oneline -5  # Find last good commit
git revert --no-commit <bad-commit>..HEAD
git commit -m "Rollback: Critical production issue"
git push origin main
```

## Phase 5: Post-Verification

### Log Results
Update `memory/YYYY-MM-DD.md` with:
- Deployment commit hash
- Verification results
- Any issues found + resolution
- Time to verify

### Alert if Issues
If deployment fails verification:
- Notify {USER_NAME} immediately
- Document in `org/issues/`
- Create remediation plan

## Automation Opportunities

### To Build
1. **Health Check Script:** `scripts/verify-production.mjs`
   - Tests all API endpoints
   - Validates response schemas
   - Returns PASS/FAIL

2. **GitHub Action:** `.github/workflows/production-verify.yml`
   - Runs after Vercel deploy
   - Executes verification script
   - Opens issue if verification fails

3. **Slack/Discord Integration:**
   - Notify on deploy start
   - Notify on verification pass/fail
   - Alert on critical failures

## Decision Authority

| Decision | Authority |
|----------|-----------|
| Deploy to production | Auto (GitHub push) |
| Verify deployment | {AI_NAME} (automated + manual) |
| Fix and redeploy | {AI_NAME} (non-critical) |
| Rollback production | {USER_NAME} approval required |
| Disable auto-deploy | {USER_NAME} approval required |

## Current Status

**Last Deployed:** 2026-02-24 15:48 EST — commit `84b31be`
**Status:** ✅ Dev verified, awaiting production verification
**Next Action:** Run Phase 2 verification on production URL
