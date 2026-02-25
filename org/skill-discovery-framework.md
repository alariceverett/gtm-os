# Skill Discovery Framework

## Purpose
Systematically identify, document, and create specialized skills and agents for recurring tasks.

## Discovery Process

### Trigger Conditions

Create a new skill when ANY of the following occur:

1. **Repetition Threshold**
   - Same task pattern repeated 3+ times
   - Similar implementation across different features
   - Copying code between projects

2. **Complexity Threshold**
   - Complex logic that benefits from standardization
   - Multiple agents need same capability
   - High risk of errors without proper patterns

3. **Modularity Opportunity**
   - Swappable component (Apollo ↔ ZoomInfo, etc.)
   - Reusable across projects
   - Clear interface/contracts

4. **Quality Improvement**
   - Current approach has repeated bugs
   - Manual steps that could be automated
   - Missing documentation/consistency

### Skill Categories

#### Category 1: Infrastructure Skills
- Database operations (migrations, RLS, queries)
- API clients (Rate limiting, retries, caching)
- Queue systems (Job processing, scheduling)
- Security (Auth, validation, encryption)

#### Category 2: Domain Skills
- Research (Apollo, enrichment, data pipelines)
- Outreach (Email, social, sequences)
- Analytics (Reporting, dashboards, metrics)
- Compliance (GDPR, rate limits, safety)

#### Category 3: Tooling Skills
- Claude Code workflow
- Testing patterns
- Documentation generation
- Deployment automation

### Detection Methods

#### Method 1: Code Pattern Analysis
```
Weekly review of:
- Repeated imports
- Similar function signatures
- Copy-paste patterns
- Similar error handling
```

#### Method 2: Agent Feedback
```
After each agent session, log:
- What was hard?
- What was repeated?
- What would have been easier with a skill?
```

#### Method 3: Human Observation
```
User mentions:
- "I keep doing..."
- "I wish I had..."
- "Every time I..."
```

## Skill Creation Workflow

### Step 1: Document Gap
File: `org/skill-gaps.jsonl`
```json
{
  "date": "2026-02-24",
  "discovered_by": "research-lead",
  "pattern": "Multiple components need Supabase Realtime subscriptions",
  "skill_name": "supabase-realtime",
  "complexity": "medium",
  "priority": "high",
  "evidence_files": ["lib/db.ts", "hooks/use-prospects.ts", "app/research/page.tsx"]
}
```

### Step 2: Research Best Practices
- Check existing implementations
- Research community patterns
- Identify edge cases
- Define success criteria

### Step 3: Design Skill
Create: `skills/[skill-name]/SKILL.md`
Contents:
- Purpose and scope
- Tools/capabilities
- Prerequisites
- Usage patterns
- Quality gates
- Examples

### Step 4: Create Reusable Components
- Helper functions
- Type definitions
- Test utilities
- Template files

### Step 5: Document and Share
- Add to agent skill lists
- Update documentation
- Train agents on usage
- Measure adoption

## Agent Discovery

### New Agent Triggers

1. **Workload Capacity**
   - Current agent has >6 active tasks
   - Similar tasks competing for same agent

2. **Domain Specialization**
   - Deep expertise needed (security, SEO, etc.)
   - Cross-cutting concerns
   - Specialized oversight

3. **Process Complexity**
   - Multi-stage process needs coordinator
   - Different teams need separate agents
   - Parallel processing required

### Agent Creation Workflow

1. **Document Need**
   File: `org/agent-needs.jsonl`
   ```json
   {
     "date": "2026-02-24",
     "need": "Every implementation needs security review",
     "agent_name": "safety-lead",
     "responsibilities": ["Review all implementations", "Enforce compliance"],
     "priority": "high"
   }
   ```

2. **Define Agent**
   Create: `org/agents/[agent-name].md`
   - Identity and focus
   - Skills
   - Quality gates
   - Workflow
   - Communication patterns

3. **Test Agent**
   - Run pilot task
   - Gather feedback
   - Iterate on prompt

4. **Deploy**
   - Add to AGENT_ARCHITECTURE.md
   - Update relevant skills
   - Document in roster

## Continuous Monitoring

### Weekly Reviews
- Scan skill-gaps.jsonl
- Review agent-needs.jsonl
- Check for patterns in recent work

### Monthly Assessment
- Skill effectiveness (usage, success rate)
- Agent workload distribution
- New opportunities identified

### Quarterly Updates
- Deprecate underused skills
- Promote proven patterns
- Major skill/agent restructuring

## Current Trackers

### Active Gaps (To Create)
1. `supabase-realtime` - Realtime subscriptions
2. `job-queue-management` - Job orchestration
3. `data-enrichment-pipeline` - Enrichment flow

### Active Agent Needs (To Create)
1. `integration-lead` - API management
2. `performance-lead` - Optimization
3. `testing-lead` - Automation

## Success Metrics

| Metric | Target | Review |
|--------|--------|--------|
| Skill reuse rate | >50% | Weekly |
| Agent task completion | >90% | Weekly |
| Time saved per skill | >2 hrs | Monthly |
| Quality improvement | Bug reduction | Monthly |

## Integration with Workflows

### In HEARTBEAT checks:
- Review skill-gaps for new entries
- Check agent workloads
- Propose new skills from recent patterns

### In Agent Completion:
- Log: "What skill would have helped?"
- Update skill performance
- Flag needs for new skills

### In Retrospectives:
- Discuss skill effectiveness
- Identify new gaps
- Plan skill/agent updates

---

*Framework version 1.0*
