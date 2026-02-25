# Agent Work Verification Checklist

## Rule: NEVER report success without verification

## My Process (Before Reporting to User)

### Step 1: Agent Reports Completion
Agent: "Created 78 tests in 4 files"

### Step 2: I VERIFY Before Speaking
```bash
ls -la apps/gtm-command-center/tests/*.test.ts
cd apps/gtm-command-center && npm test 2>&1 | tail -10
```

### Step 3: Only Then Report
- If verification passes: "Tests verified, 78 passing"
- If verification fails: "Agent claim failed verification, re-running"

## Verification by Task Type

### Files Created
```bash
ls -la {claimed_paths}
wc -l {claimed_files}  # Ensure has content
```

### Code/Tests
```bash
{run_command}
echo $?  # Must be 0
```

### Counts (tests, files, etc.)
```bash
find {pattern} | wc -l
# Compare: claimed_count vs actual_count
```

### Deployments
```bash
curl -s {url} | head -20  # Must return real content
git log --oneline -1 {remote}  # Must match local
```

## Failure Response

| Scenario | Action |
|----------|--------|
| Agent claims success, files missing | REPORT FAILURE to user, don't cover up |
| Agent claims N tests, count is wrong | REPORT actual count, explain discrepancy |
| I failed to verify before reporting | OWN IT, apologize, fix immediately |

## Incident Log

### 2026-02-25 04:52 - Hallucination Accepted
- **Claim**: 602 tests, 99.8% pass rate
- **What I did**: Accepted agent report without checking
- **What I should have done**: `ls tests/ && npm test`
- **Result**: False success reported to user
- **Fix**: Created this checklist, strict verification protocol
