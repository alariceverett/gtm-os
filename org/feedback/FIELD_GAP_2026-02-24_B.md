# [Field Gap] Agent Execution Timeout Pattern + Block Decomposition Standard

**Reported:** 2026-02-24 08:45 EST  
**Reporter:** Main orchestrator  
**Classification:** Process standard / tooling resilience  
**Status:** UPSTREAM_LOGGED

---

## Problem

**Observed:** Phase 4 Autonomy agent (complex multi-file task, ~2 hour scope) failed twice at 5-8 minutes runtime with system termination (not logic errors). Pattern indicates token/time limit exceeded before completion.

**Failure Pattern:**
```
Attempt 1: 5 min, terminated, 331k tokens → FAILED
Attempt 2: 8 min, terminated, 324k tokens → FAILED
```

**Root Cause:** Large-scope tasks exceed subagent resource limits (token/time boundaries) before completion, causing silent termination without result.

---

## Expected Behavior

System should auto-detect large-scope tasks and decompose into micro-blocks without user intervention.

---

## Proposed Fix: Block Decomposition Protocol (STANDARD)

### Trigger Conditions
When **ANY** of following detected:
- Task scope >2 hours estimated
- Multiple deliverables (4+ files/components)
- Complex integration across multiple layers
- Previous attempt failed with timeout/termination

### Auto-Decomposition Rules

1. **Single-File Rule:** Each block = 1 file max (unless trivial types)
2. **Independent Execution:** Each block runs as separate agent
3. **Parallel by Default:** Spawn all blocks simultaneously
4. **Partial Success Accepted:** Phase complete if 75%+ blocks succeed
5. **User Override:** Allow user to force single-block with warning

### Block Sizing Guidelines

| Complexity | Block Scope | Max Duration | Deliverable |
|------------|-------------|--------------|-------------|
| Low | 1 function/class | 15 min | Single file |
| Medium | 2-3 related methods | 30 min | Single file + types |
| High | Complex class + hooks | 45 min | 1-2 files |
| Critical | Multi-layer integration | 60 min | 2-3 files max |

### Execution Pattern

```
User Request (Large Scope)
    ↓
[DETECT] Scope > threshold?
    ↓ YES
[DECOMPOSE] Into micro-blocks (4A, 4B, 4C, 4D)
    ↓
[SPAWN] Parallel agents (all blocks simultaneously)
    ↓
[TRACK] Individual block completion
    ↓
[ASSEMBLE] Successful blocks = phase complete
    ↓
[REPORT] What succeeded, what failed, what's pending
```

### Example: Phase 4 Autonomy (Decomposed)

**Original (Failed):**
- Single agent: 4 files + dashboard update
- 2 hours scope
- Result: Terminated at 5 min

**Decomposed (Running):**
- 4A: Task generator only (2b1f999d)
- 4B: Self-healing only (07ac6b14)
- 4C: Predictive guard only (b9401df3)
- 4D: Dashboard hook only (0ff9899b)
- Result: Parallel execution, partial success accepted

---

## Acceptance Criteria

- [ ] Orchestrator auto-detects oversized tasks
- [ ] Auto-decomposes into parallel micro-blocks
- [ ] No user intervention required for standard cases
- [ ] Reports partial success clearly
- [ ] Allows manual override with `--single-block` flag

---

## Implementation

**Immediate:** Field agent (this workspace) now implements decomposition protocol.
**Standard:** Add to `org/PERMANENT_SUBAGENT_ROSTER.md` as spawn pattern.
**Tooling:** Consider agent-side size estimator to pre-decompose before spawn.

---

## Related

- `FIELD_GAP_2026-02-24.md` (silent completion pattern)
- `org/DELEGATION_SYSTEM.md` (task sizing guidelines)

**Status:** DEPLOYED (active execution via 4 parallel micro-blocks)