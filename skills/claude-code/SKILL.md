# Claude Code Skill

## Overview
Use Claude Code CLI for development tasks with proper workflow, feedback loops, and quality gates.

## Purpose
This skill enables agents to delegate implementation work to Claude Code CLI agents with:
- Proper planning and research before coding
- Implementation with tests and documentation
- Code review and feedback loops
- Quality verification before completion

## Tools Required

### Claude Code CLI
- Install: `npm install -g claude-code`
- Run: `claude-agent [task]` via `sessions_spawn(mode="session")`

### Required Context Files
Always load these before any task:
1. `SKILL.md` (this file)
2. `TASK_DESIGN.md` (if exists)
3. `org/AGENT_ARCHITECTURE.md`
4. Any existing CODEBASE_*.md files

## Workflow

### Phase 1: Planning
**MANDATORY** - Never skip planning

1. **Read Context**
   ```
   read(SKILL.md)
   read(TASK_DESIGN.md) if exists
   read(AGENT_ARCHITECTURE.md)
   read any relevant CODEBASE files
   ```

2. **Research Brief**
   - Identify technical constraints
   - Research best practices
   - Review similar implementations in codebase
   - Document dependencies

3. **Peer Review Request**
   - Tag relevant agent leads for review
   - Wait for approval before implementation

4. **Create DESIGN.md**
   Document in: `.claude/design/YYYYMMDD_[task-name].md`
   Contents:
   - Overview
   - Technical approach
   - Database schema changes
   - API contracts
   - Testing strategy
   - Risk assessment

### Phase 2: Implementation

1. **Spawn Claude Code Agent**
   ```
   sessions_spawn(
     task="DESIGN.md content + implementation instructions",
     agentId="appropriate-lead",
     mode="run",
     thinking="medium"
   )
   ```

2. **Monitor Progress**
   - Check every 2-3 minutes
   - Look for errors or blockers
   - Provide guidance if stuck

3. **Implementation Structure**
   Claude Code agent must:
   ```
   # 1. Read DESIGN.md
   claude-agent: "Read .claude/design/[file].md and understand requirements"
   
   # 2. Explore existing code
   claude-agent: "Explore codebase to understand patterns"
   
   # 3. Implement
   claude-agent: "Write code with tests"
   
   # 4. Document
   claude-agent: "Create CODEBASE_[feature].md"
   
   # 5. Verify
   claude-agent: "Run tests and lint"
   ```

### Phase 3: Review & Feedback

1. **Self-Review**
   Claude Code agent reviews its own work:
   - Check against DESIGN.md
   - Verify test coverage
   - Review code quality

2. **Peer Review**
   Spawn review agent:
   ```
   sessions_spawn(
     task="Review this implementation: [files] against [DESIGN.md]",
     agentId="safety-lead",
     mode="run"
   )
   ```

3. **Human Review** (if high-risk)
   - Present completed work
   - Summarize changes
   - Request approval

4. **Iterate Based on Feedback**
   - Address review comments
   - Re-spawn Claude Code if major changes
   - Update DESIGN.md with revisions

### Phase 4: Validation

1. **Automated Tests**
   - Run full test suite
   - Check coverage >80%
   - Verify integration tests pass

2. **Manual Validation**
   - Test in staging environment
   - Verify UI/UX if applicable
   - Check performance

3. **Sign-off**
   - Agent confirms feature works
   - Safety lead approves compliance
   - Documentation complete

### Phase 5: Deployment

1. **Staging Deploy**
   - Deploy to staging URL
   - Run integration tests
   - Monitor for 24 hours

2. **Production Deploy**
   - Deploy to production
   - Monitor error rates
   - Verify functionality

3. **Post-Mortem**
   - Document what worked
   - Document issues encountered
   - Archive DESIGN.md
   - Update skills if needed

## Usage Patterns

### Pattern 1: Database Schema
```
1. Write migration design
2. Get review
3. Spawn: "Implement migration for [table] per design"
4. Verify: Runs successfully
5. Deploy: To production
```

### Pattern 2: API Integration
```
1. Research API (Apollo, etc.)
2. Write integration design
3. Spawn: "Implement Apollo MCP client per design"
4. Test: Run against real API
5. Review: Peer review
6. Deploy: To production with monitoring
```

### Pattern 3: Complex Feature
```
1. Break into sub-tasks
2. Design each sub-task
3. Spawn in sequence (dependencies)
4. Review each completion
5. Integrate components
6. Full system testing
```

## Quality Gates (MANDATORY)

Every Claude Code implementation MUST:

1. **Have DESIGN.md**
   - No exceptions for non-trivial changes

2. **Have Tests**
   - Minimum 80% coverage
   - Unit tests required
   - Integration tests for APIs

3. **Have Documentation**
   - CODEBASE_[feature].md file
   - API documentation if applicable
   - Inline code comments

4. **Pass Lint/Type Check**
   - Build succeeds
   - Zero TypeScript errors
   - Zero ESLint errors

5. **Pass Security Review**
   - No hardcoded secrets
   - Proper RLS policies
   - Input validation

6. **Pass Human Review** (if high-risk)
   - Core business logic
   - Security changes
   - API contracts

## Feedback Collection

### Daily Standup Format
```
Agent: [name]
Task: [description]
Progress: [% complete]
Blockers: [any issues]
Next: [upcoming work]
```

### Completion Report
```
Feature: [name]
Files Changed: [count]
Lines Added: [count]
Tests Added: [count]
Coverage: [%]
Documentation: [linked]
Review Status: [approved/pending]
Deploy Status: [staged/production]
```

## Error Handling

### If Claude Code Fails

1. **Review Error**
   - Check error message
   - Check logs
   - Identify root cause

2. **Resuming**
   - If minor fix: "Fix the error and continue"
   - If major redesign: Back to Phase 1
   - Update DESIGN.md with new info

3. **Escalation**
   - If stuck >30 min: Pause and ask human
   - If blocked by external: Document blocker

## Metrics to Track

1. **Agent Performance**
   - Success rate
   - Time to completion
   - Revisions required

2. **Code Quality**
   - Test coverage
   - Bug rate post-deploy
   - Review feedback

3. **Process Efficiency**
   - Planning time vs implementation
   - Review cycle count
   - Time to production

## Example Usage

```javascript
// 1. Create design
write(".claude/design/2026-02-25_apollo_integration.md", designContent);

// 2. Get review
sessions_spawn(
  task="Review this design for Apollo integration",
  agentId="research-lead",
  mode="run"
);

// 3. Implement
sessions_spawn(
  task=`
    Read .claude/design/2026-02-25_apollo_integration.md
    Implement in files:
    - lib/apollo-client.ts
    - lib/apollo-mcp.ts
    - tests/apollo.test.ts
    - CODEBASE_APOLLO.md
    
    Use patterns from existing code
    Follow all quality gates
  `,
  agentId="outreach-lead",
  mode="run"
);

// 4. Review
sessions_spawn(
  task="Review apollo implementation against design",
  agentId="safety-lead",
  mode="run"
);

// 5. Deploy
// (after approval)
```

## Next Steps

1. Create DESIGN.md template
2. Establish review board (agent assignments)
3. Setup monitoring/feedback collection
4. Run pilot with Phase 2

## Related Files

- `AGENT_ARCHITECTURE.md` - Agent definitions
- `DESIGN_TEMPLATE.md` - Design doc template  
- `FEEDBACK_PROCESS.md` - Feedback handling
- `QUALITY_GATES.md` - Detailed quality criteria