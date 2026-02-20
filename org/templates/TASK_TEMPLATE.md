# [TASK_ID] — [Brief Title]

## Metadata

| Key | Value |
|-----|-------|
| **Task ID** | `[TASK_ID]` |
| **Client** | `[CLIENT_ID]` |
| **Category** | `[CATEGORY]` (e.g., proposal-writing, copywriting, analysis) |
| **Division** | `[DIVISION_ID]` (client-work or internal-ops) |
| **Project** | `[PROJECT_ID]` |
| **Expected Revenue** | `$[AMOUNT]` |
| **Status** | `in_progress` → `completed` / `failed` / `revision` |
| **Created** | `[ISO_TIMESTAMP]` |
| **Agent** | `[AGENT_NAME]` |

## Specification

_What is this task? What's the expected outcome?_

- Scope: [1-2 sentences]
- Acceptance Criteria: [bulleted checklist]
- Special Notes: [constraints, dependencies, edge cases]

## Work Log

As you work, log significant steps here. Include timestamps for billable time tracking.

```
[HH:MM] Started research phase
[HH:MM] Completed first draft
[HH:MM] Revision requested — logged as manual_cost_adjustment
```

## Model Usage

_This section auto-populates from session history. Don't manually edit._

```
Model: anthropic/claude-sonnet-4.5-latest
Tokens In: 2500 | Tokens Out: 1800 | Cost: $0.27

Model: anthropic/claude-haiku-4.5-latest  
Tokens In: 800 | Tokens Out: 400 | Cost: $0.04

Total Cost: $0.31
```

## Deliverable

- **File:** `output/[FILENAME]`
- **Format:** [e.g., PDF, DOCX, JSON, markdown]
- **Quality Score:** `[0-10]` (subjective quality assessment)
- **Ready for Client:** `yes` / `no` / `needs revision`

## Final Metrics

| Metric | Value |
|--------|-------|
| **Duration** | [HH:MM] |
| **Total Cost** | `$[0.00]` |
| **Actual Revenue** | `$[AMOUNT]` |
| **Margin** | `$[AMOUNT]` (`[X]%`) |
| **Cost per Minute** | `$[0.00]` |

---

## How Cost Logging Works

**You don't manually calculate costs.** Here's the flow:

1. **At task start:** Agent logs task metadata (client, category, expected revenue)
2. **During execution:** Agent runs models; OpenClaw captures session tokens automatically
3. **At completion:** Agent logs outcome and deliverable
4. **Post-processing:** Infrastructure script reads session history, calculates costs, writes to `.task_log.jsonl`

### For Task Agents

When you start a task:
```
Task ID: task-abc123
Client: acme-corp
Category: proposal-writing
Expected Revenue: $150
```

When you complete it:
```
Task Status: completed
Deliverable: proposal.pdf
Quality Score: 9.2/10
```

That's it. The logging system handles the rest.

### For Division Leads

Monitor aggregated costs in `division_summary.json` and `org_aggregate.json`. These auto-update every 5 minutes.

### For CEO

Use the CEO Dashboard to track margin trends, model efficiency, and revenue per category.

---

**Status:** Created [DATE] | Last Updated [DATE] | Phase: [PHASE]
