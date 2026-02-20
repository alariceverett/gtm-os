---
name: deploy-and-verify
description: Verify deployments after git push. Tests critical endpoints and reports PASS/FAIL. Use after any deploy to {YOUR_DOMAIN}.
---


# Deploy and Verify

Verify that a Vercel deployment completed successfully and critical endpoints respond correctly.

## Usage

Run the verification script after any git push:

```bash
bash /path/to/skills/deploy-and-verify/scripts/verify-deploy.sh [BASE_URL] [NEW_ENDPOINT]
```

- `BASE_URL` — defaults to `https://{YOUR_DOMAIN}`
- `NEW_ENDPOINT` — optional path to verify (e.g., `/api/new-feature`)

## Workflow

1. After `git push`, run the script immediately
2. Script polls for up to 3 minutes waiting for fresh deployment
3. Tests all critical endpoints (see `references/endpoints.md`)
4. Reports PASS/FAIL with specific failures

## Interpreting Results

- **PASS** — All endpoints returned expected status codes and response patterns
- **FAIL** — Script lists exactly which endpoints failed and why
- If build is stale after 3 minutes, script reports deployment timeout

## When to Auto-Trigger

Run this skill automatically after any `git push` to {your_domain} repositories. Do not wait for the user to ask — verify proactively.

## Critical Endpoints

See `references/endpoints.md` for the full list of endpoints, expected status codes, and response patterns.
