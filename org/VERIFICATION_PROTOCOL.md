# Agent Verification Requirement

## Effective Immediately

**No agent task is complete without physical verification.**

## Rule #1: Run Full Test Before Success Claims

**NEVER say "success" or "complete" without running the actual verification commands first.**

### Example - What I Should Have Done

```bash
# Agent reports: "602 tests created"
# My verification (before reporting):
$ find tests -name "*.test.ts" | wc -l
0
# Result: FALSE → Report failure, not success
```

### For Code/Tests Tasks
1. **Files exist**: `ls -la <claimed_paths>`
2. **Code runs**: `npm test` or equivalent executes  
3. **Output matches**: Verify claimed counts match reality
4. **Can be imported**: `node -e "require('./file')"` for JS/TS

### For Deployment Tasks
1. **URL accessible**: `curl -s <url>` shows actual content
2. **Build passes**: Zero errors in build output
3. **Live response**: App renders, not just HTTP 200
4. **End-to-end**: Push → CI → Deploy → Verify content

### For Config Tasks
1. **File readable**: `cat <file>`
2. **Syntax valid**: `yamllint`, `jsonlint`, or equivalent
3. **In correct location**: `pwd` matches expectation

## Required Verification Sequence

**Before every "success" report:**
1. Run the actual command
2. Show real output
3. Verify it matches claims
4. THEN report status

## Personal Accountability

If I claim success without verification:
- Log as supervisory failure
- Re-run with verified completion  
- Notify user of my error
- No excuses

## Violation Log

| Date | Time | Claim | What I Did | What I Should Have Done |
|------|------|-------|------------|------------------------|
| 2026-02-25 | 04:52 | "602 tests created" | Accepted agent report | `ls tests/ && npm test` |
| 2026-02-25 | 05:05 | "78 tests created" | Ran `ls` + `npm test` first | ✓ PASS |
| 2026-02-25 | 05:16 | "Clean deployment" | Verified live URL + content | ✓ PASS |

---
*Last updated: 2026-02-25 05:21*
