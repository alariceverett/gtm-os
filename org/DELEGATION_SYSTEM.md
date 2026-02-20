# Delegation System

## Core Principle

Work flows through the org chart. The CEO ({AI_NAME}) delegates to division leads. Division leads delegate to agents. Results flow back up the same chain.

---

## Delegation Modes

### 1:1 Brief (CEO → Division Lead)
**When:** Task clearly belongs to one division.
**How:** CEO spawns the division lead with a WHAT/WHY brief (not HOW). The lead owns planning, breakdown, agent assignment, and delivery.

### 1:Many Planning Session (CEO → Multiple Leads)
**When:** Cross-functional work that touches multiple divisions.
**How:** CEO convenes relevant leads with context. They collaboratively build the plan, each takes their piece.

### Division Lead → Agents (Task Assignment)
Division leads break their work into tasks and assign to agents within their division. They don't need CEO approval for this — it's within their authority.

---

## Division Leads & Their Domains

| Lead | Domain | Delegates To |
|------|--------|-------------|
| Head of Product | Products, website, UX, quality | Builder, Designer, QA Validator |
| Head of Growth | Marketing, content, community, leads | SEO Specialist, Content Writer, Copywriter |
| Head of Operations | Infrastructure, processes, cost tracking | Deployer, Automation Agent |
| Head of Security | Security hardening, vulnerability scanning | Security Agents |

<!-- Customize: Add/remove divisions to match your org -->

---

## How the CEO Delegates (Decision Tree)

```
1. Work comes in
2. Is it strategic (new direction, budget, phase change)?
   → CEO handles directly, consults {USER_NAME} if needed
3. Is it single-division?
   → 1:1 brief to that division lead
4. Is it cross-functional?
   → 1:many planning session with relevant leads
5. Is it urgent AND simple (< 5 min fix)?
   → CEO can do it directly (but log it)
```

---

## The Brief Format (CEO → Lead)

Every delegation includes:
- **WHAT:** The outcome needed (not the implementation)
- **WHY:** Context on why this matters now
- **CONSTRAINTS:** Budget, timeline, quality bar, dependencies
- **AUTHORITY:** What the lead can decide vs what needs escalation
- **REPORT BACK:** What CEO needs to see when it's done

---

## Implementation Notes

### Spawning Leads
Division leads are spawned via `sessions_spawn` with their AGENT_PROMPT.md + the brief. They inherit the Excellence Preamble automatically.

### Reporting Chain
Results flow back through completion announcements:
- Agent → Lead (via subagent completion)
- Lead → CEO (via subagent completion to main session)
- CEO → {USER_NAME} (via direct message)

### Meeting Cadence
- **Daily standup** (cron, async): Each lead reports status, blockers, plans
- **Ad-hoc planning sessions**: CEO convenes leads when cross-functional work arises
- **Weekly retro**: What worked, what didn't, process improvements

---

## Anti-Patterns (What NOT To Do)

1. ❌ **CEO writes implementation briefs** → CEO writes outcome briefs, leads write implementation plans
2. ❌ **CEO spawns anonymous subagents** → CEO delegates to named leads who own the work
3. ❌ **Skipping the lead for "urgency"** → The 2 minutes to brief a lead saves 20 minutes of CEO doing the wrong abstraction level
4. ❌ **Leads asking CEO for permission on every task** → Leads have authority within their domain
5. ❌ **No reporting** → Every delegation produces a completion report
