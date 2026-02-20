# Skill Pack Template

Use this template to convert any book, framework, or domain into an actionable agent skill pack.

---

## 1. Metadata

```yaml
skill_pack:
  name: ""                    # e.g. "strategic-pricing"
  version: "1.0"
  source:
    book: ""                  # Full title
    author: ""
    isbn: ""                  # Optional
    domain: ""                # e.g. "Pricing Strategy", "UX Research"
  target:
    agent_roles:              # Which agents use this
      - ""
    skill_level: ""           # foundational | intermediate | advanced
    prerequisites: []         # Other skill packs needed first
  estimated_size: ""          # S (<2k tokens) | M (2-5k) | L (5-10k) | XL (10k+)
  last_updated: ""
  distilled_by: ""
```

---

## 2. Core Principles

Extract 10–15 principles. Each is **one sentence**, actionable, and testable. Number them for reference in decision trees and examples.

Format:

> **P1: [Principle Name]** — [One sentence stating the principle as an imperative.]

Example:

> **P1: Price on Value, Not Cost** — Set prices based on the customer's willingness to pay for the outcome, never on your cost to deliver.

Write all 10–15 here:

1. **P1:** —
2. **P2:** —
3. ...

---

## 3. Decision Trees

For the key decisions an agent faces in this domain, provide flowcharts in text form. Reference principles by number.

### Decision Tree: [Name]

```
START → [Question?]
  ├─ Yes → [Action] (see P3)
  │   └─ [Sub-question?]
  │       ├─ Yes → [Action] (see P7)
  │       └─ No  → [Action] (see P2)
  └─ No  → [Action] (see P1)
```

Include 2–4 decision trees covering the most common scenarios.

---

## 4. Worked Examples

For each core principle, provide 3–5 worked examples showing the full reasoning chain.

### Example [N]: [Short Title]

**Context:** [Situation the agent is in]

**Input:**
```
[What the agent receives — a request, data, brief, etc.]
```

**Reasoning (chain-of-thought):**
1. Identify: [What principle applies and why]
2. Assess: [Key factors considered]
3. Decide: [Choice made, referencing decision tree if applicable]

**Output:**
```
[What the agent produces]
```

**Why this works:** [1-2 sentences explaining why this is correct]

---

## 5. Anti-Patterns

Common mistakes agents make in this domain. Each includes the mistake, why it's wrong, and the correction.

### Anti-Pattern [N]: [Name]

- **What it looks like:** [Description of the bad output/behavior]
- **Why it's wrong:** [Explanation referencing principles]
- **Correction:** [What to do instead]
- **Example:**
  - ❌ Bad: `[example]`
  - ✅ Good: `[example]`

Include 5–10 anti-patterns.

---

## 6. Self-Check Rubric

The agent runs this checklist on its own output before delivering. Each item is pass/fail.

| # | Check | Principle | Pass Criteria |
|---|-------|-----------|---------------|
| 1 | | P1 | |
| 2 | | P3 | |
| 3 | | P5, P7 | |
| ... | | | |

**Scoring:**
- All pass → Ship it
- 1–2 fail → Revise those items
- 3+ fail → Re-do from scratch using decision trees

---

## 7. Quick Reference Card

A compressed version (< 500 tokens) the agent can load into context for fast recall. Should contain:
- The numbered principles (one line each)
- The most critical anti-pattern
- The top 3 self-check items

---

## File Structure

```
skill-packs/
└── [skill-name]/
    ├── SKILL_PACK.md          # This file (full version)
    ├── QUICK_REF.md           # Section 7 extracted standalone
    ├── examples/
    │   ├── example-01.md
    │   ├── example-02.md
    │   └── ...
    ├── decision-trees/
    │   ├── tree-01.md
    │   └── ...
    └── tests/
        ├── test-inputs.md     # Inputs for validation
        └── expected-outputs.md # Gold-standard outputs to compare against
```

---

## Distillation Process

When creating a new skill pack from a book:

1. **Read/summarize** the entire book into key arguments
2. **Extract principles** — distill arguments into 10-15 imperatives
3. **Build decision trees** — map the author's recommended decision process
4. **Create examples** — translate book case studies into agent-relevant scenarios
5. **Identify anti-patterns** — invert principles + add common LLM failure modes
6. **Write rubric** — one check per principle, concrete pass/fail
7. **Compress** — write the quick reference card
8. **Test** — run 5 sample inputs through the skill pack, compare to expected output
9. **Iterate** — refine based on test failures

Estimated time per book: 2-4 hours of focused agent work.
