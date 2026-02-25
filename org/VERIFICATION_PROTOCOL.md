# Agent Verification Requirement

## Effective Immediately

**No agent task is complete without physical verification.**

### Verification Protocol

Before marking any task DONE, the supervising agent (me) MUST:
1. Run the specific verification command for the task type
2. Capture actual output showing success
3. Only then report completion to user

### Verification by Task Type

| Task Type | Verification Command | Success Criteria |
|-----------|---------------------|----------------|
| Create files | `ls -la <path>` | File exists, size > 0 |
| Create tests | `npm test` or `find . -name "*.test.ts" | wc -l` | Tests run, count > 0 |
| Deploy | `curl -s <url>` | HTTP 200 |
| Config | `cat <file>` | File readable, syntax valid |
| Build | `npm run build` | Exit code 0 |
| Setup | `<tool> --version` or `which <tool>` | Tool installed |

### Agent Task Instructions — Add to ALL spawns

```markdown
**CRITICAL: Verification Required**
Before reporting completion, you MUST:
1. Verify all created files exist: `ls -la <paths>`
2. Verify code runs: execute the test/build command
3. Document actual output in your report

If verification fails, report PARTIAL or FAILURE with specific error.
Never report SUCCESS without evidence.
```

### My Accountability

If I report agent success without verification:
1. Log as supervisory failure in VERIFICATION_FAILURES.log
2. Re-run task with verified completion
3. Update this document with lesson learned
4. Notify user of my error (no deflection)

---
*Last updated: 2026-02-25 04:58*
