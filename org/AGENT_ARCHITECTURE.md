# Agent Architecture for GTM OS Development

## Overview
This document defines the specialized agents, skills, and feedback loops for autonomous development using Claude Code.

---

## Core Agent Definitions

### 1. `research-lead`
**Purpose:** Lead all research-related development
**Expertise:**
- Database schema design
- Apollo.io integration
- Data enrichment
- MCP server usage
- API rate limiting

**Claude Code Skills:**
- Supabase migrations
- TypeScript/React components
- REST API clients
- Testing with Jest

**Quality Gates:**
1. Schema extensibility check
2. API rate limit compliance
3. Data validation
4. Error handling
5. Test coverage >80%

**Feedback Loop:**
- Weekly architecture review
- Performance metrics (query times)
- Data quality reports

---

### 2. `outreach-lead`
**Purpose:** Lead outreach automation development
**Expertise:**
- Email delivery (SMTP/API)
- Multi-channel orchestration
- Sequence logic
- Personalization at scale
- Deliverability optimization

**Claude Code Skills:**
- Queue system implementation (Bull/BullMQ)
- Email template engines
- Social API integration
- A/B testing frameworks

**Quality Gates:**
1. Rate limit compliance
2. Unsubscribe handling
3. Bounce/spam detection
4. Deliverability monitoring
5. Human approval integration

**Feedback Loop:**
- Daily campaign metrics
- Weekly deliverability reports
- Monthly strategy reviews

---

### 3. `abm-lead`
**Purpose:** Lead ABM and strategy generation
**Expertise:**
- ABM playbook design
- Account scoring
- Multi-touch attribution
- Campaign orchestration
- ROI calculation

**Claude Code Skills:**
- Complex business logic
- Data analysis pipelines
- Report generation
- Strategy recommendation engines

**Quality Gates:**
1. Strategy coherence
2. Personalization quality
3. Attribution accuracy
4. Cost/benefit validation
5. Human review integration

**Feedback Loop:**
- Weekly strategy performance
- Bi-weekly refinement sessions
- Quarterly playbook updates

---

### 4. `safety-lead`
**Purpose:** Oversee all compliance and safety mechanisms
**Expertise:**
- GDPR/CAN-SPAM compliance
- Rate limiting
- Cost controls
- Data privacy
- Human oversight

**Claude Code Skills:**
- Policy enforcement systems
- Audit logging
- Circuit breakers
- Alerting/monitoring

**Quality Gates:**
1. Compliance verification
2. Rate limit stress testing
3. Cost cap validation
4. Data access audit
5. Emergency shutdown procedures

**Feedback Loop:**
- Real-time compliance monitoring
- Daily safety reports
- Incident post-mortems

---

### 5. `ux-lead`
**Purpose:** Lead dashboard and command interface development
**Expertise:**
- Natural language UX
- Dashboard design
- Real-time updates
- Accessibility

**Claude Code Skills:**
- React/Next.js
- Supabase Realtime
- State management
- Component libraries

**Quality Gates:**
1. User flow testing
2. Accessibility (WCAG)
3. Performance (FCP <1s)
4. Mobile responsiveness
5. Error boundary coverage

**Feedback Loop:**
- User session recordings
- Bi-weekly UX audits
- Quarterly user interviews

---

## Claude Code Integration

### Skill Definitions

#### Skill: `supabase-schema`
**Purpose:** Design and implement Supabase database schemas
**Tools:**
- Migration file generation
- RLS policy creation
- Trigger functions
- Index optimization

**Prerequisites:**
- PostgREST knowledge
- PostgreSQL fundamentals
- JSONB query patterns

**Success Metrics:**
- Query performance <100ms
- Schema extensibility index >8/10
- Zero data loss on migration

---

#### Skill: `apollo-mcp`
**Purpose:** Integrate Apollo.io via MCP server
**Tools:**
- MCP client setup
- Rate limit management
- Data enrichment pipelines
- Health monitoring

**Prerequisites:**
- HTTP client proficiency
- Retry/circuit breaker patterns
- API authentication

**Success Metrics:**
- <1% API errors
- Cost per enrichment <$0.01
- Response time <2s

---

#### Skill: `command-parser`
**Purpose:** Build natural language command interfaces
**Tools:**
- Intent classification
- Entity extraction
- Context management
- Auto-complete systems

**Prerequisites:**
- NLP fundamentals
- State machines
- Error recovery patterns

**Success Metrics:**
- Intent accuracy >90%
- Command latency <100ms
- User satisfaction >4/5

---

#### Skill: `queue-system`
**Purpose:** Implement distributed job queues
**Tools:**
- Bull/BullMQ setup
- Redis connection pooling
- Job state management
- Dead letter handling

**Prerequisites:**
- Event-driven architecture
- Error retry strategies
- Monitoring/observability

**Success Metrics:**
- Job completion rate >99%
- Retry rate <5%
- Queue latency <10s

---

#### Skill: `compliance-guard`
**Purpose:** Build compliance and safety systems
**Tools:**
- Policy engines
- Rate limiters
- Audit logging
- Emergency shutoffs

**Prerequisites:**
- GDPR/CAN-SPAM knowledge
- Cost estimation
- Risk analysis

**Success Metrics:**
- Zero compliance violations
- Cost variance <10%
- Human escalation rate <20%

---

## Feedback Loop Framework

### Planning Phase

1. **Research Brief Generation**
   - Agent creates research brief
   - Identifies constraints and risks
   - Estimates effort/dependencies

2. **Peer Review**
   - Other leads review brief
   - Technical debt assessment
   - Alternative approach comparison

3. **Human Review**
   - Present to human for approval
   - Clarify ambiguous requirements
   - Set success criteria

4. **Approval**
   - Sign off on approach
   - Commit resources
   - Set timeline

### Implementation Phase

1. **Daily Standup** (Automated)
   - Progress report
   - Blocker identification
   - Next day forecast

2. **Mid-Phase Review** (50% completion)
   - Code quality check
   - Test coverage review
   - Architecture validation

3. **Implementation Completion**
   - Feature complete
   - Tests passing
   - Documentation ready

### Validation Phase

1. **Self-Review**
   - Agent runs its own code
   - Identifies edge cases
   - Suggests improvements

2. **Peer Review**
   - Other agents review
   - Feedback on quality
   - Suggestions for polish

3. **Human Review**
   - Demo to human
   - Feedback collection
   - Priority adjustments

4. **Acceptance Testing**
   - Verify against requirements
   - Performance benchmarks
   - Security review

### Deployment Phase

1. **Staging Deployment**
   - Deploy to staging
   - Run integration tests
   - Monitor for 24h

2. **Production Deployment**
   - Deploy to production
   - Real-time monitoring
   - Rollback plan ready

3. **Post-Deployment Review**
   - Measure success criteria
   - Document learnings
   - Update skills

### Continuous Improvement

1. **Weekly Metrics Review**
   - Performance data
   - Error rates
   - User feedback

2. **Monthly Retrospective**
   - What worked well
   - What needs improvement
   - Skill updates needed

3. **Quarterly Architecture Review**
   - Technical debt assessment
   - Scaling considerations
   - Tool upgrade decisions

---

## Agent Session Management

### Session Creation
```
sessions_spawn(
    task="...",
    agentId="research-lead",
    skills=["supabase-schema", "apollo-mcp"],
    mode="run" | "session"
)
```

### Session Monitoring
- Track completion status
- Monitor for errors/stuck agents
- Resource usage tracking

### Session Feedback
```
subagents(action="steer", target="session-id", message="feedback")
```

---

## Skill Performance Metrics

Track each skill's performance:
- Usage frequency
- Success rate
- Time to completion
- Error rate
- Cost per use
- User satisfaction

### Monthly Skill Review
- Retire underperforming skills
- Promote successful patterns
- Update documentation

---

## Implementation: Creating the System

### Step 1: Create Skill Files
```
skills/
├── claude-code/           # Base Claude Code skill
├── supabase-schema/
│   └── SKILL.md
├── apollo-mcp/
│   └── SKILL.md
├── command-parser/
│   └── SKILL.md
├── queue-system/
│   └── SKILL.md
└── compliance-guard/
    └── SKILL.md
```

### Step 2: Create Agent Definitions
```
org/
├── agents/
│   ├── research-lead.md
│   ├── outreach-lead.md
│   ├── abm-lead.md
│   ├── safety-lead.md
│   └── ux-lead.md
```

### Step 3: Setup Monitoring
```
org/metrics/
├── agent-performance.json
├── skill-usage.json
└── feedback-archive/
```

---

Next Steps:
1. Create skill files for this project
2. Define agent prompt templates
3. Setup feedback collection mechanism
4. Run pilot with Phase 2 (using this system)