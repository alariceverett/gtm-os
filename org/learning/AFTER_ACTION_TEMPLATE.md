# After-Action Template

Use this after every completed task. Be honest, be specific, be brief. This takes 2 minutes and makes every future task better.

---

## Quick Version (minimum viable after-action)

```json
{
  "task_id": "",
  "agent_role": "",
  "division": "",
  "timestamp": "",
  "objective": "What were you trying to accomplish? (1 sentence)",
  "approach": "What approach did you take? (1-2 sentences)",
  "went_well": ["Be specific. 'Client loved the before/after comparison' not 'it went well'"],
  "went_poorly": ["Be honest. 'Missed the mobile responsive requirement entirely' not 'some issues'"],
  "would_change": ["What would you do differently next time?"],
  "quality_scores": {"overall": 0, "technical": 0, "communication": 0, "design": 0},
  "key_insight": "One sentence. The single most important thing to remember.",
  "tags": ["skill-area tags for cross-division discovery"],
  "time_spent_hours": 0,
  "revision_count": 0,
  "client_feedback": null
}
```

Save to: `/org/learning/after_actions/YYYY-MM-DD.jsonl` (append, one entry per line)

---

## Guidelines

**On `went_well`:**
- What specifically worked? Not "the proposal was good" but "opening with the client's own revenue numbers grabbed attention"
- Would this work again on a different task? If yes, it might be a playbook entry

**On `went_poorly`:**
- What specifically failed or underperformed? Root cause, not just symptom
- "The dashboard lacked narrative" → WHY? → "No storytelling requirement in the brief, and I didn't think to add one"
- Be honest. Nobody's grading you on this. The org is grading itself

**On `would_change`:**
- Concrete and actionable. "Start with the executive summary next time" not "try harder"
- If you'd change nothing, you probably aren't being critical enough

**On `key_insight`:**
- Compress your entire experience into one sentence
- "Technical sophistication doesn't compensate for poor communication"
- This is what gets surfaced in weekly reviews. Make it count

**On `tags`:**
- Use skill-area tags: `storytelling`, `specificity`, `data-viz`, `persuasion`, `client-empathy`
- Use task-type tags: `dashboard`, `proposal`, `analysis`, `report`
- These enable cross-division discovery. A `#storytelling` insight from proposals reaches the dashboard team

---

## When Quality Scores Aren't Available

If the task wasn't formally scored by the quality critic, self-assess using:
- **10:** Genuinely world-class. Client would showcase this.
- **8-9:** Excellent. Minimal or no revisions needed. Client is impressed.
- **6-7:** Acceptable. Gets the job done. Wouldn't embarrass us.
- **4-5:** Below standard. Needs significant revision.
- **1-3:** Failed. Doesn't meet basic requirements.

Self-assessments are marked as such and recalibrated during weekly review.

---

*Remember: A skipped after-action is experience wasted. Two minutes now saves hours later.*
