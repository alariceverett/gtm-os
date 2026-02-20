# Intake Fields

Minimum inputs to bootstrap an app. Every field has a default suggestion — the assistant proposes, the user corrects.

**How to use:** Don't hand this to the user as a form. The assistant fills it out based on the user's plain-language description, then presents it for lightweight confirmation.

---

## Problem Statement
*What problem does this app solve?*

- **Default:** Summarize the user's initial description into a single sentence.
- **Example:** "Teams can't track shared habits and hold each other accountable."

## Users & Roles
*Who uses this and what can they do?*

- **Default:** Two roles — `admin` (full access) and `member` (own data + team view).
- **Override if:** More roles needed, or single-user app (no roles).

## Core Workflows
*The 2-3 things users do most. This drives the vertical slice.*

- **Default:** Derive from the problem statement. Usually: create → view/manage → share/collaborate.
- **Example:** "1. Create a habit 2. Log daily check-ins 3. View team progress"

## Must-Have Screens
*The minimum UI to support core workflows.*

- **Default:** 5 screens — Landing, Auth, Dashboard (list), Detail (single item), Settings.
- **Override if:** App needs additional views (e.g., admin panel, public profile, reporting).

## Auth Model
*How do users sign in?*

- **Default:** Email + password via Supabase Auth.
- **Alternatives:** OAuth (Google/GitHub), magic link, anonymous → upgrade.
- **Override if:** Enterprise SSO needed, or app is fully public (no auth).

## Integrations
*External services the app talks to.*

- **Default:** None. Supabase handles everything.
- **Common additions:** Email (Resend), payments (Stripe), analytics (PostHog), file processing.

## Data Sensitivity Level
*Determines security posture.*

| Level | Description | Default Measures |
|---|---|---|
| **Low** | Public content, no PII | Standard RLS, HTTPS |
| **Medium** | User accounts, personal data | RLS + auth + audit logging |
| **High** | Financial, health, legal data | All of Medium + encryption at rest, SOC2 considerations |

- **Default:** Medium (user accounts with personal data).
- **Override if:** Handling payments, health data, or operating in regulated industry.

## Deployment Target
*Where does this run?*

- **Default:** Vercel (frontend) + Supabase (backend). See [DEPLOYMENT_PROFILE.md](./DEPLOYMENT_PROFILE.md).
- **Override if:** Need custom server, specific cloud provider, or on-premises.

## Acceptance Criteria
*How do we know it's done?*

- **Default:** Core workflows work end-to-end, deployed to production, passes [Security Checklist](../security/SECURITY_CHECKLIST.md).
- **User should add:** Specific business rules, performance targets, or compliance requirements.
- **Example:** "A user can create a habit, log 7 days of check-ins, and see a streak counter."

---

## Filled Example

> **Problem:** "I want a habit tracker for teams"
>
> | Field | Proposed | Confidence |
> |---|---|---|
> | Problem | Teams need shared habit tracking with accountability | 🟢 High |
> | Roles | Admin (manages team), Member (tracks own habits) | 🟡 Medium |
> | Core workflows | Create habit → Log check-in → View team dashboard | 🟢 High |
> | Screens | Landing, Auth, Dashboard, Habit Detail, Settings | 🟢 High |
> | Auth | Email + password | 🟢 High |
> | Integrations | None initially | 🟡 Medium |
> | Data sensitivity | Medium (personal habit data) | 🟢 High |
> | Deploy target | Vercel + Supabase | 🟢 High |
> | Acceptance | User creates habit, logs 7 days, sees streak | 🟡 Medium |
>
> **User only needs to confirm or tweak the 🟡 items.**
