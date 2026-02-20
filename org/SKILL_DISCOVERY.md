# Skill Discovery System

> The org doesn't wait to be told what skills it needs. It notices gaps, logs them, and builds solutions automatically.

## How It Works

```
Agent starts task → Checks /skills/ for relevant skill
  ├─ Found → Uses it
  └─ Not found → Logs gap to org/skill-gaps.jsonl → Proceeds with best effort
                        ↓
              Skill Builder cron (2x daily)
                        ↓
              Reads gaps → Groups similar → Builds top unaddressed skill
                        ↓
              New skill registered in /skills/ → Gap marked resolved
```

---

## 1. Skill Gap Detection

Every agent, before starting any task, runs a skill check. If no matching skill exists, they log the gap and continue.

### The Snippet (Added to Every Agent Prompt)

```
## Pre-Task Skill Check

Before starting, check if a relevant skill exists in `skills/`. 
If you find one, read its SKILL.md and follow its guidance.

If no relevant skill exists, log the gap:
echo '{"date":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","agent":"YOUR_ROLE","task":"TASK_DESCRIPTION","skill_needed":"SKILL_NAME","description":"WHY_THIS_WOULD_HELP"}' >> org/skill-gaps.jsonl

Then proceed with best effort. Don't block on missing skills.
```

### Gap Entry Format

```json
{
  "date": "2026-02-20T14:00:00Z",
  "agent": "head-of-growth",
  "task": "Write LinkedIn outreach sequence",
  "skill_needed": "linkedin-outreach",
  "description": "Need templates for connection requests, follow-ups, and InMail sequences. Currently writing from scratch each time.",
  "resolved": false,
  "resolved_by": null
}
```

### What Makes a Good Gap Log

- **Specific skill name** — not "marketing" but "linkedin-outreach" or "cold-email-sequences"
- **Why it would help** — what capability is missing, what the agent had to improvise
- **Task context** — so the skill builder knows the real use case

---

## 2. Skill Builder Cron

Runs twice daily. Reads unresolved gaps, groups them, and builds the highest-impact skill.

### Cron Configuration

```yaml
name: skill-builder
schedule: "0 6,18 * * *"    # 6 AM and 6 PM UTC
model: anthropic/claude-sonnet-4-20250514
prompt: |
  You are the Skill Builder. Your job is to identify and build the most needed skill.

  ## Process

  1. Read `org/skill-gaps.jsonl` — filter to entries where `resolved` is false or missing
  2. Group similar gaps (e.g., multiple agents needing "email-writing" related skills)
  3. Rank by: frequency (how many gaps) × recency (newer = higher priority)
  4. For the top unaddressed group:
     a. Read `org/training/SKILL_PACK_TEMPLATE.md` for the skill pack format
     b. Research the domain (web search for best practices, frameworks, examples)
     c. Build the skill:
        - Create `skills/{skill-name}/SKILL.md` with usage instructions
        - Create `skills/{skill-name}/references/` with supporting material
        - Create `skills/{skill-name}/scripts/` if the skill needs automation
     d. Mark all matching gaps as resolved in `org/skill-gaps.jsonl`:
        Update each entry: `"resolved": true, "resolved_by": "skill-name"`
  5. Log what you built to `org/skill-build-log.jsonl`

  ## Quality Bar
  - Every skill must be immediately usable by an agent with no additional context
  - SKILL.md must include: when to use, how to use, what it produces
  - References must include at least one worked example
  - If the skill needs external tools/APIs, document the setup

  ## Skip If
  - No unresolved gaps exist → reply HEARTBEAT_OK
  - Top gap is too vague to build a useful skill → log why, move to next
```

### Build Log Format

```json
{
  "date": "2026-02-20T18:00:00Z",
  "skill_built": "linkedin-outreach",
  "gaps_resolved": 3,
  "gap_agents": ["head-of-growth", "proposal-writer", "head-of-growth"],
  "files_created": ["skills/linkedin-outreach/SKILL.md", "skills/linkedin-outreach/references/templates.md"],
  "notes": "Built from 4 gap entries over 3 days. Includes connection request, follow-up, and InMail templates."
}
```

---

## 3. Bootstrap Domain Analysis

During first boot (BOOTSTRAP.md), after learning the problem domain, the system pre-seeds likely skill gaps so the builder starts working immediately — before any agent even hits a gap.

### How It Works

After the bootstrap conversation establishes the domain, the AI:

1. Analyzes the stated goals and problem domain
2. Maps goals to likely agent roles and task types
3. For each task type, checks if a skill exists
4. Seeds `org/skill-gaps.jsonl` with predicted needs

### Example: E-commerce Domain

If the user says "I'm building an AI-powered e-commerce optimization business," the bootstrap seeds:

```jsonl
{"date":"2026-02-20T10:00:00Z","agent":"bootstrap","task":"domain-analysis","skill_needed":"shopify-api","description":"E-commerce clients likely use Shopify. Need API integration patterns.","resolved":false}
{"date":"2026-02-20T10:00:00Z","agent":"bootstrap","task":"domain-analysis","skill_needed":"product-listing-optimization","description":"Core service: optimizing product listings. Need copywriting frameworks specific to e-commerce.","resolved":false}
{"date":"2026-02-20T10:00:00Z","agent":"bootstrap","task":"domain-analysis","skill_needed":"conversion-rate-analysis","description":"Clients will want CRO. Need analysis frameworks and benchmark data.","resolved":false}
{"date":"2026-02-20T10:00:00Z","agent":"bootstrap","task":"domain-analysis","skill_needed":"email-marketing-sequences","description":"Post-purchase and abandoned cart sequences are table stakes.","resolved":false}
```

The Skill Builder cron picks these up within 12 hours and starts building.

### Bootstrap Seed Prompt (Added to BOOTSTRAP.md)

```
After establishing who you are and your domain, analyze the problem space:

1. What are the 5-10 most common tasks you'll need to perform?
2. For each task, what specialized skill would make you 10x better?
3. Check if each skill exists in skills/
4. For missing skills, seed org/skill-gaps.jsonl with bootstrap entries

This gives the Skill Builder a head start. Within 24 hours of first boot,
you'll have purpose-built skills for your domain.
```

---

## 4. Skill Lifecycle

```
Gap Detected → Logged → Grouped → Built → Registered → Used → Improved
                                                          ↑         |
                                                          └─────────┘
                                                        (after-action feedback
                                                         improves the skill)
```

### Skill Improvement Loop

When an agent uses a skill and logs an after-action:
- If the skill helped → note what worked (skill gets positive signal)
- If the skill was insufficient → log a new, more specific gap
- If the skill was wrong → flag for revision in `org/skill-gaps.jsonl` with `"type": "revision"`

### Revision Entry Format

```json
{
  "date": "2026-02-21T09:00:00Z",
  "agent": "proposal-writer",
  "task": "Write SaaS proposal using linkedin-outreach skill",
  "skill_needed": "linkedin-outreach",
  "description": "Skill covers B2C outreach well but missing B2B enterprise patterns. Need: multi-thread outreach, champion-building sequences.",
  "type": "revision",
  "resolved": false
}
```

The Skill Builder treats revisions as higher priority than new builds (improving existing > building new).

---

## 5. Metrics

Track in `org/skill-discovery-metrics.json` (updated by Skill Builder):

```json
{
  "total_gaps_logged": 47,
  "total_gaps_resolved": 38,
  "skills_built": 12,
  "skills_revised": 3,
  "avg_time_to_resolve_hours": 14.2,
  "most_requested_skills": ["cold-email", "data-viz", "api-integration"],
  "unresolved_gaps": 9,
  "last_updated": "2026-02-20T18:00:00Z"
}
```

### Health Indicators

- **Gap backlog growing** → Skill Builder needs to run more frequently or be more efficient
- **Same skill requested after being built** → Skill quality is low, needs revision
- **No gaps being logged** → Agents aren't checking (add reminders to prompts) or the org is mature
- **Time-to-resolve > 48h** → Builder is falling behind, consider manual intervention

---

*This system makes the org self-bootstrapping: point it at any domain and it discovers what it needs to know.*
