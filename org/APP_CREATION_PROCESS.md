# App Creation Process (Forge Principles)

## Goal
Start building an application from zero quickly, while only asking the user for essential missing info.

## Step 1 — Minimum Intake (ask only what is missing)
Required inputs:
1. Problem to solve (1 paragraph)
2. Primary users/roles
3. Top 3 workflows
4. Must-have screens (v1)
5. Authentication model (none/email/SSO)
6. Integrations required (CRM, billing, etc.)
7. Data sensitivity level (low/medium/high)
8. Deployment target (Vercel/Render/AWS/etc.)
9. Success criteria for v1 (what “working” means)

## Step 2 — Decision + Delegation Logging
- Record initial product decision in decision engine
- Delegate architecture/UI/data tasks
- Log steps + assumptions + learnings

## Step 3 — Build Plan
Create a one-page execution plan:
- architecture sketch (frontend/backend/db)
- API endpoints for core workflows
- UI route map
- schema draft
- milestone plan (vertical slice first)

## Step 4 — Build Vertical Slice First
Implement one complete path end-to-end:
- single user flow
- one core screen
- one API endpoint + DB write/read
- basic validation + error states

## Step 5 — Deploy and Verify
- Deploy to staging
- Run deploy verification checks
- Log failures + fixes

## Step 6 — Weekly Improvement Loop
- summarize what shipped
- summarize what blocked progress
- open/append Forge feedback issue with structural gaps

## Output Artifacts
- `org/GTM_OPERATING_CADENCE.md`
- `org/WORK_QUEUE.md`
- `org/TASK_BACKLOG.md`
- `org/APP_CREATION_PROCESS.md`
- decision/delegation/process logs in DB
