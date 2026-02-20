# Improvement Engine — Operational Mechanics

> How the learning system actually works, day to day.

---

## Per-Task Learning

Every task produces an after-action entry. Every single one. This is non-negotiable.

### When It Happens

Immediately after task completion, before the agent moves on. The after-action is the LAST step of every task, not a separate task that gets scheduled and forgotten.

### What Gets Logged

A structured JSONL entry at `/org/learning/after_actions/YYYY-MM-DD.jsonl`:

```json
{
  "task_id": "PROP-001",
  "agent_role": "dashboard_builder",
  "division": "client_services",
  "timestamp": "2026-02-17T21:43:00Z",
  "objective": "Build interactive marketing dashboard demo for Upwork proposal",
  "approach": "Built full React dashboard with live data simulation, deployed to demo.{org_domain}.io",
  "went_well": ["Infrastructure automation works — deploy script is reusable", "Design system codified for future use", "Leading with a working demo differentiates us"],
  "went_poorly": ["Dashboard communicated data but not insight", "No narrative layer — just charts", "Took 16.6 hours, target was <30 min with automation"],
  "would_change": ["Add executive summary with key insights at top", "Include annotations on charts explaining 'so what?'", "Build from template instead of from scratch"],
  "quality_scores": {"overall": 6, "technical": 8, "communication": 4, "design": 6},
  "key_insight": "Technical capability without communication quality produces impressive but unpersuasive work.",
  "tags": ["dashboard", "storytelling", "first-proposal", "infrastructure"],
  "time_spent_hours": 16.6,
  "revision_count": 0,
  "client_feedback": null
}
```

### What Makes a Good After-Action

- **Specificity over generality.** "The chart colors were hard to read on mobile" beats "could improve design."
- **Honesty over ego.** The whole point is to learn. Sugarcoating failures means repeating them.
- **One clear insight.** Force yourself to distill. What's the ONE thing future-you needs to know?
- **Tags that enable discovery.** Tag by skill area, not just topic. A proposal insight about "specificity" should be tagged `#specificity` so the dashboard team finds it too.

---

## Division-Level Aggregation (Weekly)

Every Friday (or when 5+ after-action entries accumulate, whichever comes first), the division lead runs a review.

### Process

1. **Collect** all after-action entries from the division for the week
2. **Score distribution** — What's our average quality? What's the trend?
3. **Pattern scan** — Read through entries looking for:
   - Recurring problems (same mistake twice = system issue, not individual issue)
   - Emerging strengths (things we're getting consistently good at)
   - Skill gaps (areas where scores are consistently low)
   - Surprises (things nobody expected — these are often the richest insights)
4. **Cross-division check** — Any insights tagged with skills relevant to other divisions?
5. **Action items** — Concrete changes:
   - Prompt updates (with specific language to add/remove)
   - New playbook entries (with examples from this week's work)
   - New anti-pattern entries (with specific "instead, do X")
   - Skill level adjustments (any agent demonstrably improved or regressed?)

### Output

A division weekly report at `/org/learning/weekly_reviews/YYYY-WNN-[division].md` using the weekly review template.

### What Gets Escalated to CEO

- Cross-division insights (tagged for lateral flow)
- Skill gaps that need investment (Sonnet/Opus time for development)
- Process issues that affect multiple divisions
- Market signals from client feedback
- Metrics that are trending significantly up or down

---

## Org-Level Synthesis (Weekly, CEO)

Every Monday, as part of the CEO weekly brief to {USER_NAME}.

### Process

1. **Review** all division weekly reports
2. **Cross-pollinate** — Push insights from one division to others
3. **Trend analysis** — Are we getting better overall? Which dimensions?
4. **Resource allocation** — Where should we invest learning time this week?
5. **Strategy check** — Do our learnings suggest any strategic adjustments?

### Output

- Updated organizational priorities
- Cross-division prompt updates
- Investment decisions (e.g., "spend 2 Sonnet-hours on dashboard storytelling practice")
- Section in CEO weekly brief to {USER_NAME}: "What We Learned This Week"

---

## Prompt Evolution System

Agent prompts are living documents. They evolve based on evidence, not intuition.

### The Prompt Lifecycle

```
v1.0 Initial prompt (based on role definition + best guesses)
  ↓ evidence from tasks
v1.1 Add "Do: Lead proposals with specific dollar amounts" (from PROP-003 success)
  ↓ evidence from tasks
v1.2 Add "Don't: Use generic chart titles like 'Revenue Over Time'" (from AP-002)
  ↓ evidence from tasks
v1.3 Update reference example (replace old example with better one from TASK-047)
  ↓ evidence from tasks
v1.4 Remove instruction about X (data shows it doesn't affect quality)
```

### Rules for Prompt Changes

1. **Every change has a rationale.** Logged in `/org/learning/prompt_changelog.jsonl`:
   ```json
   {
     "timestamp": "2026-02-25T10:00:00Z",
     "agent_role": "proposal_writer",
     "prompt_version": "1.3",
     "change_type": "add_instruction",
     "change": "Added: 'Include at least 3 specific dollar amounts or percentages in every proposal'",
     "rationale": "Proposals with specific numbers scored 8.2 avg vs 6.1 without (n=12)",
     "evidence": ["PROP-003", "PROP-007", "PROP-011"],
     "reversible": true
   }
   ```

2. **Changes are testable.** After a prompt change, track quality scores for the next 5 tasks using that prompt. If scores drop, roll back.

3. **Less is more.** Long prompts dilute attention. When adding a new instruction, ask: can we remove an old one? The goal is a focused, high-signal prompt — not an encyclopedia.

4. **Examples > instructions.** "Here's what good looks like" teaches more than "do it this way." Prefer adding reference examples over adding rules.

### Version Control

- Prompts stored at `/org/agents/prompts/[role]_v[N.N].md`
- Current version symlinked or referenced in agent config
- Previous versions kept for rollback
- Changelog at `/org/learning/prompt_changelog.jsonl`

---

## Benchmarking Against the Market

### Monthly Benchmark Cycle

**Week 1: Research**
- Search for best-in-class examples in each service category
- Check competitor portfolios, case studies, public work
- Save examples to `/org/learning/benchmarks/[category]/`

**Week 2: Score**
- Score our recent work against benchmarks using the same quality rubric
- Be brutally honest — the point is to find gaps, not feel good

**Week 3: Plan**
- For each significant gap, create a specific improvement plan
- "Our dashboards score 6/10 on storytelling vs benchmark 9/10"
- "Specific gap: benchmarks include contextual annotations; ours don't"
- "Plan: Add annotation requirement to dashboard builder prompt, create 3 reference examples"

**Week 4: Implement**
- Push changes from improvement plans
- Track whether next month's scores improve

### What "World-Class" Looks Like (Updated Monthly)

Each benchmark entry includes:
- The example itself (or link)
- What makes it excellent (specific, not vague)
- How our recent work compares (honest gap assessment)
- What we'd need to change to match it

---

## Metrics That Matter

### Leading Indicators (predict future quality)
- After-action completion rate (target: 100%)
- Playbook consultation rate (are agents actually checking playbooks?)
- Prompt update frequency (healthy: 2-4 changes per role per week)
- Cross-division insight flow (at least 1 per week)

### Lagging Indicators (measure actual improvement)
- Average quality score trend (should be increasing)
- Revision rate (should be decreasing)
- Client feedback scores (should be increasing)
- Time-to-completion (should be decreasing for repeated task types)
- Win rate on proposals (should be increasing)

### Anti-Metrics (things that look good but aren't)
- Number of playbook entries (more ≠ better; quality matters)
- Length of agent prompts (longer ≠ better; focus matters)
- Number of after-action entries (if quality is low, volume doesn't help)

---

*Created: 2026-02-18 | Owner: {AI_NAME} (CEO) | Review cycle: Monthly*
