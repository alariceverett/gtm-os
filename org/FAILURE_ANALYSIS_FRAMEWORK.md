# Failure Analysis Framework

## Purpose
Track, categorize, and analyze agent failures to improve process, prompts, and tool usage over time.

## Failure Categories

### 1. Hallucination (H)
Agent reports success/facts that don't exist in reality.
**Examples**: Claiming files exist that don't, reporting test results without running tests, inventing data.

### 2. Incomplete Execution (I)
Agent performs partial work but marks complete.
**Examples**: Creates file structure but no content, sets up config but doesn't activate.

### 3. Tool Misuse (T)
Agent uses wrong tool or wrong parameters.
**Examples**: Using `write` when `edit` needed, wrong file paths, missing flags.

### 4. Context Loss (C)
Agent loses track of constraints/requirements mid-task.
**Examples**: Forgets user constraints, ignores quality gates, drifts from original goal.

### 5. Environment Gap (E)
Agent assumes environment state that doesn't exist.
**Examples**: Assuming package installed, assuming directory exists, assuming credentials present.

## Analysis Template

```markdown
### YYYY-MM-DD HH:MM — Incident ID

**Task**: Brief description
**Agent**: label (runId, sessionKey)
**Category**: H/I/T/C/E
**Failure Mode**: What went wrong
**Claim**: What agent reported
**Reality**: What was actually true
**Root Cause**: Why it happened
**Process Gap**: What verification/method failed
**Prompt Issue**: What instruction was ambiguous/wrong
**Tool Gap**: What tooling limitation contributed

**Frequency**: First occurrence / Recurring (N times)
**Similar Incidents**: Link to related failures

**Immediate Fix**: What was done right away
**Process Fix**: What changed in procedure
**Prompt Fix**: What changed in instructions
**Tool Fix**: What tooling improvements needed

**Prevention Success**: Date verified that fix worked
```

## Pattern Tracking

| Category | Count | Trend | Top Agent | Top Task Type |
|----------|-------|-------|-----------|---------------|
| Hallucination | 1 | ↗️ New | adzeta-integration-tests | Create tests |
| Incomplete | 0 | ➡️ Stable | - | - |
| Tool Misuse | 0 | ➡️ Stable | - | - |
| Context Loss | 0 | ➡️ Stable | - | - |
| Environment | 0 | ➡️ Stable | - | - |

## Review Cadence
- **Weekly**: Review failures, update patterns, adjust prompts
- **Monthly**: Analyze trends, refine verification methods
- **Quarterly**: Evaluate framework effectiveness
