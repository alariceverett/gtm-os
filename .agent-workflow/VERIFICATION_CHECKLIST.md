# Agent Work Verification Checklist

## Rule: Never report success without verification

### For Code/Tests Tasks
1. **Files exist**: `ls -la <claimed_paths>`
2. **Code runs**: `npm test` or equivalent executes
3. **Output matches**: Verify claimed counts match reality
4. **Can be imported**: `node -e "require('./file')"` for JS/TS

### For Deployment Tasks
1. **URL accessible**: `curl -s -o /dev/null -w "%{http_code}" <url>`
2. **Build passes**: Zero errors in build output
3. **Process running**: `pgrep` or equivalent

### For Config Tasks
1. **File readable**: `cat <file> | head -5`
2. **Syntax valid**: `yamllint`, `jsonlint`, or equivalent
3. **In correct location**: `pwd` matches expectation

## Verification Log

Track failures to identify agents/models prone to hallucination:

```markdown
### 2026-02-25 04:52
- **Agent**: adzeta-integration-tests (fb9efeef)
- **Claim**: 602 tests, 99.8% pass rate
- **Reality**: 0 test files exist
- **Action**: Re-spawned with stricter requirements
```
