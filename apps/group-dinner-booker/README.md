# Group Dinner Booker (NYC) — v1

A practical planning and execution app for NYC group dinners.

## Core v1 Promise

Help an organizer move from **"we should do dinner"** to **"booked + confirmed"** by supporting two booking paths:

1. **Reservation platform path** (Resy/OpenTable/direct links)
2. **Large-party outreach path** (email/contact form to restaurant for 8+ or custom menus)

Both paths feed one shared status tracker so no details get lost.

## What is included in this folder

- `docs/product-spec-v1.md` — product goals, scope, MVP, acceptance criteria
- `docs/user-flows-v1.md` — primary user journeys and state transitions
- `docs/data-model-v1.md` — entities, relationships, and lifecycle notes
- `docs/implementation-scaffold-plan-v1.md` — architecture, milestones, and starter implementation plan
- `docs/request-intake-shortlist-v1.md` — v1 intake validation + shortlist scoring scaffold and acceptance checks
- `db/schema.sql` — SQL scaffold for v1 data model
- `docs/large-party-outreach-workflow-v1.md` — outreach lifecycle, cadence policy, and tracking model
- `templates/outreach/email-templates-v1.md` — reusable email variants + follow-up snippets
- `templates/outreach/contact-form-copy-v1.md` — contact-form-safe outreach copy
- `templates/outreach/follow-up-cadence-v1.md` — operational follow-up policy
- `templates/outreach/tracking-fields-v1.csv` — analytics/ops tracking field dictionary

## Suggested stack

- Next.js + TypeScript
- Supabase Postgres (or Postgres + Prisma)
- Transactional email provider for outreach + follow-up (Resend/Postmark)

## v1 framing

NYC-focused for launch:
- Neighborhood-aware search (Manhattan, Brooklyn, Queens)
- Group size ranges common for work/friends dinners (6–20)
- Time windows around weekday evenings and weekend prime slots
