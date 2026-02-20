# Priority System

## Two Levels

### 1. Org Priority Queue
The company's ranked list of what matters most. Owned by CEO ({AI_NAME}), approved by {USER_NAME}.

Every item has:
- **Rank** — position in the queue (1 = do first)
- **Title** — what it is
- **Owner** — which division/lead owns execution
- **Phase** — which phase is active (if phased)
- **Status** — queued, active, blocked, complete
- **Why this rank** — brief justification for its position

### 2. Agent Priority Queue
Each division lead and agent maintains their own queue, derived from the org queue.

- Items come from: org queue assignments, lead breakdown of org items, sub-tasks from phased work
- Rank is influenced by: org priority (primary), dependencies, blockers, rate limits/resource constraints
- When the org queue changes, agents re-rank accordingly

## How Priority Changes Cascade

```
{USER_NAME} changes org priority
  → {AI_NAME} updates org queue
    → Affected leads get notified (via brief or steer)
      → Leads re-rank their agent queues
        → Agents work top-of-queue
```

## Resource Constraints

Current real constraints:
- **Rate limits** — can't run unlimited parallel agents
- **Browser contention** — only one agent can use the browser at a time
- **Model budget** — expensive models should be used strategically

The queue IS the resource allocation.

## When to Re-rank

- **{USER_NAME} gives direction** — immediate re-rank
- **Phase completes** — next phase enters queue at appropriate rank
- **Blocker clears** — blocked item moves to its natural rank
- **New information** — market signal, client response changes the calculus
- **CEO's judgment** — CEO can re-rank within tactical authority

## The Org Queue

Lives at `org/WORK_QUEUE.md`. This is the single source of truth for what the company is working on.
