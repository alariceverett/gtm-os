# App Bootstrap — Zero to Deployed

The end-to-end runbook for building a new app using Forge. Opinionated, guess-first, defaults over questions.

## Philosophy

**Don't ask — propose.** The assistant drafts everything based on stated goals, presents assumptions with confidence levels, and the user only corrects what's wrong. This is a product builder, not a form.

## The Seven Steps

### Step 1: Propose First Draft

User states their goal in plain language. The assistant immediately generates:
- A completed [INTAKE_FIELDS.md](./INTAKE_FIELDS.md) with best guesses for every field
- A draft [BUILD_PLAN_TEMPLATE.md](./BUILD_PLAN_TEMPLATE.md)
- Stack selections from [DEFAULT_STACK_PROFILE.md](./DEFAULT_STACK_PROFILE.md)

**Do not ask clarifying questions first.** Propose, then refine.

### Step 2: Confidence-Based Review

Present all assumptions in a table:

| Assumption | Confidence | Default |
|---|---|---|
| Auth model: email + password | 🟢 High | Supabase Auth |
| Two user roles: admin + member | 🟡 Medium | RBAC via RLS |
| Dashboard is the main screen | 🟡 Medium | React + Tailwind |
| No mobile app needed | 🟢 High | Web-only |
| Public-facing landing page | 🔴 Low | Needs confirmation |

**Rules:**
- 🟢 High confidence → proceed unless user objects
- 🟡 Medium → state the assumption, ask "sound right?"
- 🔴 Low → ask directly, but still propose a default

User edits only what's wrong. Everything else ships as-is.

### Step 3: Scaffold from Default Stack

Using the confirmed plan:

1. Initialize repo from [DEFAULT_STACK_PROFILE.md](./DEFAULT_STACK_PROFILE.md)
2. Set up [DEPLOYMENT_PROFILE.md](./DEPLOYMENT_PROFILE.md) — env vars, secrets, URLs
3. Configure CI/CD pipeline
4. Create Supabase project + initial schema
5. Wire auth, deploy skeleton to staging

**Log the decision** via the [Decision Framework](../DECISION_FRAMEWORK.md) — record stack choices and rationale.

### Step 4: Vertical Slice First

Build one complete path through the app — not horizontal layers. Pick the core workflow identified in intake and implement:
- Database table(s) for that workflow
- API/query layer (Supabase client)
- UI screens (route → component → data)
- Auth gate if applicable

**Why vertical?** It proves the stack works end-to-end and gives the user something real to react to. Reference [Product Process](../PRODUCT_PROCESS.md) for the design→build→QA flow.

### Step 5: Deploy to Staging

Push the vertical slice to staging using the [Deployment Profile](./DEPLOYMENT_PROFILE.md):
- Verify env vars are set
- Run migrations
- Deploy to Vercel preview
- Smoke test core workflow

### Step 6: Deploy-and-Verify

Run the full verification checklist:
- [ ] Core workflow works end-to-end
- [ ] Auth flow (sign up, sign in, sign out)
- [ ] RLS policies enforced (test as different roles)
- [ ] No console errors
- [ ] Mobile-responsive (if applicable)
- [ ] Performance: LCP < 2.5s
- [ ] Error states handled

Cross-reference with [Security Checklist](../security/SECURITY_CHECKLIST.md) and [Completion Checklist](#completion-checklist) below.

### Step 7: After-Action + Gap Log

Using the [After-Action Template](../learning/AFTER_ACTION_TEMPLATE.md):
- What went well?
- What was harder than expected?
- What assumptions were wrong?
- What skill gaps appeared?

Feed gaps into the [Improvement Engine](../learning/IMPROVEMENT_ENGINE.md) and [Skill Trees](../learning/SKILL_TREES.md).

---

## Completion Checklist

Before calling it "done":

- [ ] All intake acceptance criteria met
- [ ] Deployed to production (not just staging)
- [ ] README in repo documents setup + deploy
- [ ] Env vars documented in DEPLOYMENT_PROFILE
- [ ] After-action logged
- [ ] Decision log updated
- [ ] Skill gaps recorded

## Quick Start

```
User: "I want to build a habit tracker for teams"

→ Assistant generates full intake, build plan, and stack in one shot
→ Presents confidence table — user tweaks 2-3 things
→ Scaffold, vertical slice, deploy — all in one session
```

Total time from idea to deployed staging app: **one working session.**