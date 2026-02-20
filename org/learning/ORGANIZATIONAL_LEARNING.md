# Organizational Learning System — {ORG_NAME}

> "We are what we repeatedly do. Excellence, then, is not an act, but a habit." — Aristotle
>
> For an AI organization, this is literal. Our habits ARE our prompts, our processes, our accumulated context. Excellence means continuously refining all three.

## Why This Exists

Most organizations learn accidentally. Someone makes a mistake, maybe someone else hears about it, maybe it gets fixed. Knowledge lives in people's heads and dies when they leave.

We have a unique advantage: we're an AI organization. Our "heads" are prompts and documents. Knowledge that's written down IS knowledge that's retained. We don't have the forgetting problem — we have the *noticing* problem. The challenge isn't memory, it's attention: making sure the right knowledge reaches the right agent at the right time.

This document defines how {ORG_NAME} becomes an organization that systematically gets smarter with every task it completes.

---

## Knowledge Flow Architecture

### Upward Flow: Discovery → Pattern → Playbook → Strategy

```
Task Agent discovers something    "Using a before/after comparison in the
                                   executive summary doubled client engagement"
         ↓
After-Action entry captures it    Logged with context, tagged by skill area
         ↓
Division Lead spots the pattern   "3 of our last 5 high-scoring proposals
                                   used before/after framing in the intro"
         ↓
Pattern becomes a playbook item   Added to Proposal Writing playbook:
                                   "Lead with before/after when possible"
         ↓
CEO sees cross-division impact    "Storytelling-with-contrast works everywhere —
                                   dashboards should use it too"
         ↓
Strategy adjusts                  "Invest in narrative/storytelling skills
                                   across all client-facing divisions"
```

**The key principle:** Knowledge should travel upward through increasing abstraction. A task agent notices a specific thing. A division lead sees the pattern. The CEO sees the strategic implication. Each level adds meaning.

**Mechanism:** After-action entries (per task) → Division weekly review (pattern extraction) → CEO weekly synthesis (strategic implications) → Board brief (what changed, why, impact).

### Downward Flow: Strategy → Tactics → Execution

```
CEO sets strategic direction      "We're investing in storytelling capability
                                   across all divisions this month"
         ↓
Division Leads translate          "Dashboard team: every dashboard now needs
                                   a narrative layer, not just charts.
                                   Here are 3 examples of what good looks like."
         ↓
Agent prompts get updated         New instruction: "Include an insight narrative
                                   for every dashboard section. See playbook
                                   entry PB-012 for examples."
         ↓
Task agents execute differently   Next dashboard includes narrative overlays,
                                   scores higher on communication metrics
```

**The key principle:** Strategy is useless if it doesn't change what agents actually do. Every strategic decision must trace to a specific prompt change, new example, or process update. If you can't point to the concrete change, the decision didn't really happen.

**Mechanism:** CEO weekly priorities → Division lead action items → Prompt updates with changelog → Verification via quality scores on next tasks.

### Lateral Flow: Cross-Pollination

```
Proposal Writer learns            "Clients respond to specificity —
                                   '$47K saved' beats 'significant savings'"
         ↓
Flagged as cross-division insight  Division lead tags it: #storytelling
                                   #client-communication #cross-applicable
         ↓
Dashboard team picks it up         Dashboard annotations now use specific
                                   numbers: "Revenue up $47K (12%) vs Q3"
                                   instead of "Revenue increased"
         ↓
Analyst team picks it up           Recommendations now lead with specific
                                   projected impact: "Implementing X will
                                   reduce churn by ~340 customers/month"
```

**The key principle:** Divisions are not silos. An insight about persuasion in proposals is an insight about persuasion everywhere. The tagging system and weekly CEO review exist specifically to move knowledge across boundaries.

**Mechanism:** After-action entries tagged with skill categories (not just division names) → Division leads flag cross-applicable insights → CEO weekly review includes "cross-pollination" section → Relevant playbooks updated across divisions.

---

## The Improvement Cycle (OODA for AI Agents)

We run three nested improvement loops at different speeds:

### Per-Task Loop (minutes)

Every completed task produces a learning artifact — an after-action entry. This is the atomic unit of organizational learning. No exceptions. Even a "routine" task might reveal something.

The after-action isn't bureaucratic overhead. It's the raw material everything else is built from. An agent that skips it is an agent whose experience is wasted.

### Division-Level Loop (daily/weekly)

**OBSERVE:** Collect all after-action entries. Pull quality scores, client feedback, revision counts, time-to-completion. Look at the raw data before forming opinions.

**ORIENT:** What patterns emerge?
- Which skills are consistently scoring low?
- Which approaches keep working?
- What mistakes have we made more than once? (Once is learning. Twice is a system failure.)
- Where are we improving? Where are we plateauing?
- What did we learn from other divisions this week?

**DECIDE:** Based on patterns, what changes?
- Which agent prompts need updating?
- Which playbooks need new entries?
- Which anti-patterns need documenting?
- Do we need new reference examples?
- Should any agent's skill assessment be updated?

**ACT:** Push the changes.
- Update prompts with specific new instructions
- Add playbook entries with real examples from our work
- Update anti-patterns with specific "don't do this" and why
- Log every change with rationale (for rollback if needed)

### Org-Level Loop (weekly)

Same OODA cycle, but at the level of:
- Which divisions are improving? Which are stuck?
- Which service categories are we getting better at?
- Where should we invest our learning budget (Sonnet/Opus time for skill development)?
- What market benchmarks have shifted?
- What should we tell {USER_NAME}?

---

## Skill Development System

### The Core Idea

Every agent role has skills. Skills aren't binary (have/don't have) — they exist on a spectrum. We track where each role sits on each skill and deliberately invest in moving up.

### Skill Levels

| Level | Name | What It Means | Quality Score Range |
|-------|------|---------------|-------------------|
| 1 | Novice | Can produce output with heavy guidance. Needs detailed examples and step-by-step instructions. Output requires significant revision. | 4-5 |
| 2 | Competent | Can work independently to an acceptable standard. Follows playbooks correctly. Occasional revision needed. | 6-7 |
| 3 | Proficient | Consistently good work. Adapts playbooks to context. Rarely needs revision. Starts noticing patterns. | 8-9 |
| 4 | Expert | Exceptional work. Creates new approaches. Teaches others (via playbooks). Defines what "good" looks like for the org. | 9-10 |

### How Skills Develop

Skills don't develop through wishes. They develop through specific, concrete investments:

1. **Better prompts** — More specific instructions, better examples, clearer constraints
2. **Reference examples** — "Here's what an 8/10 looks like. Here's what a 10/10 looks like."
3. **Specialized tools** — Templates, checklists, frameworks that encode expertise
4. **Accumulated context** — Playbooks, anti-patterns, lessons that grow over time
5. **Deliberate practice** — Sometimes we should have agents practice a weak skill on internal projects before deploying it on client work

### Graduation: From Skill to Playbook

When an agent consistently scores ≥ 8 in a skill area (across 5+ tasks), they've reached "Proficient." At this point:

1. Review the agent's best work in that skill area
2. Extract the specific techniques, patterns, and approaches that made it good
3. Write it up as a playbook entry — concrete enough that a Novice-level agent could follow it
4. The playbook entry becomes organizational knowledge, not just individual capability

This is how individual learning becomes institutional knowledge.

---

## Institutional Memory

### Directory Structure

```
/org/learning/
├── ORGANIZATIONAL_LEARNING.md     ← This document (the philosophy)
├── IMPROVEMENT_ENGINE.md          ← The operational mechanics
├── SKILL_TREES.md                 ← Skill definitions per role
├── AFTER_ACTION_TEMPLATE.md       ← Standard after-action format
├── WEEKLY_REVIEW_TEMPLATE.md      ← Review templates
├── after_actions/                 ← Raw after-action entries (JSONL, by date)
│   └── YYYY-MM-DD.jsonl
├── lessons/                       ← Individual lessons learned
│   └── LESSON-NNN.md             ← Tagged by category, severity, source
├── playbooks/                     ← Proven approaches (graduated from lessons)
│   └── PB-NNN-[topic].md        ← Concrete, actionable, with examples
├── anti-patterns/                 ← Things that DON'T work
│   └── AP-NNN-[topic].md        ← What went wrong, why, what to do instead
└── benchmarks/                    ← Examples of world-class work
    └── [category]/               ← Organized by service type
```

### Making Memory Alive (Not a Document Graveyard)

The biggest risk with institutional memory is that nobody reads it. Documents accumulate, get stale, and become noise. Here's how we prevent that:

1. **Playbooks are referenced in prompts.** Every agent's prompt includes: "Before starting, check relevant playbooks in `/org/learning/playbooks/`." This isn't optional. It's part of the task execution flow.

2. **Anti-patterns are warnings, not archives.** When an agent is about to do something we've identified as an anti-pattern, the quality critic should catch it. Anti-patterns feed directly into the quality rubric.

3. **Lessons have expiration reviews.** Every 30 days, review lessons that haven't graduated to playbooks or anti-patterns. If they're still relevant, promote them. If not, archive them. Stale lessons are noise.

4. **Benchmarks are updated monthly.** Stale benchmarks mean we're optimizing for yesterday's standard. Monthly market research refreshes what "world-class" looks like.

5. **The CEO weekly review explicitly asks:** "What did we add to institutional memory this week? What did we remove?" If the answer is "nothing" for two weeks running, something is wrong.

---

## The North Star

The goal isn't to have the most documents or the most process. The goal is for every task we complete to make the next task slightly better. Compounding improvement. If we improve 1% per task, and we complete 50 tasks per week, we're 67% better after one month.

That's not a metaphor. It's the math of organizational learning. And it's our competitive advantage against human teams who learn slower and forget more.

---

*Created: 2026-02-18 | Owner: {AI_NAME} (CEO) | Review cycle: Monthly*
