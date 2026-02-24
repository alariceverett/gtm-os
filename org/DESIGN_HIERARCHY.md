# Design Team Hierarchy

_For quality UX and product experience planning_

This document defines the agent cascade for design-led workflows, ensuring user experience is considered at every stage.

## Design Team Roster

| Agent | Role | Primary Outputs |
|-------|------|-----------------|
| `product-strategy` | Product Strategy Lead | PRDs, objective definitions, success metrics |
| `user-research` | User Research Specialist | User interviews, personas, journey maps, findings |
| `ux-design` | UX/UI Design Specialist | Wireframes, prototypes, design systems, usability tests |
| `build-frontend` | Frontend Build Specialist | React/Next.js components, UI implementation |
| `build-backend` | Backend Build Specialist | APIs, data models, integrations |
| `intelligence` | Intelligence Lead | Insights synthesis, recommendations, prioritization |

## Design-First Workflow

### Phase 1: Discovery & Strategy
```
Trigger: New product or major feature request

product-strategy
├── Spawns: user-research
│   └── Output: Research brief, user interviews
├── Spawns: intelligence  
│   └── Output: Market research, competitive analysis
└── Output: Product Requirements Document (PRD)
```

### Phase 2: User Research & Design
```
Parallel execution:

user-research ────────┐
└── User interviews   │
└── Journey mapping   │
└── Pain points doc   │
                      ↓
              ux-design ←─── Intelligence synthesizes findings
              ├── Wireframes
              ├── User flows
              ├── Design system components
              └── Usability test plan
```

### Phase 3: Design Validation
```
ux-design → user-research (usability testing)
              ↓
          Test results → intelligence (analysis)
              ↓
          Refined designs
```

### Phase 4: Build
```
ux-design → build-frontend (component implementation)
              ↓
          build-backend (API + data)
              ↓
          qa-risk (validation)
```

### Phase 5: Launch
```
build-frontend + build-backend → qa-risk (final QA)
              ↓
          comms-delivery (launch messaging)
              ↓
          docs-knowledge (user docs)
```

## Quality Gates for Design

Each phase must pass these gates:

### Discovery Gate
- [ ] Problem statement validated with 3+ user sources
- [ ] Success metrics defined and measurable
- [ ] Competitive analysis complete
- [ ] Risk assessment for user impact

### Design Gate  
- [ ] Wireframes reviewed and approved
- [ ] Design accessible (WCAG 2.1 AA minimum)
- [ ] Responsive/Mobile considered
- [ ] Design system compliance

### Validation Gate
- [ ] Usability testing complete (minimum 5 users)
- [ ] Critical usability blockers resolved
- [ ] User satisfaction score documented
- [ ] Accessibility audit passed

### Build Gate
- [ ] Design implementation fidelity ≥95%
- [ ] Performance budget met
- [ ] Cross-browser/device tested
- [ ] Regression tests pass

## Handoff Schemas

### PRD Handoff (product-strategy → user-research + ux-design)
```json
{
  "artifactId": "PRD-v1.md",
  "targetUsers": "...",
  "successMetrics": [...],
  "constraints": [...],
  "researchQuestions": [...],
  "confidence": "High/Med/Low",
  "risks": [...]
}
```

### Research Handoff (user-research → ux-design)
```json
{
  "artifactId": "USER_RESEARCH_FINDINGS.md",
  "personas": [...],
  "journeyMaps": [...],
  "painPoints": [...],
  "opportunities": [...],
  "designPrinciples": [...],
  "confidence": "High/Med/Low"
}
```

### Design Handoff (ux-design → build-frontend)
```json
{
  "artifactId": "DESIGN_SYSTEM_v1.md",
  "wireframes": [...],
  "prototypes": [...],
  "components": [...],
  "accessibilityNotes": [...],
  "usabilityResults": [...],
  "confidence": "High/Med/Low"
}
```

## Parallel Workstreams

Multiple design tracks can run in parallel:
- **Track A**: New user onboarding flow (ux-design + user-research)
- **Track B**: Dashboard redesign (ux-design + intelligence)
- **Track C**: Mobile app feature (build-frontend + build-backend)

Orchestrator manages dependencies and synchronization.

## Design-Driven vs Tech-Driven

### Design-Driven (UX is primary constraint)
Use when: New product, major UX overhaul, user-facing changes
Flow: product-strategy → user-research → ux-design → build-*

### Tech-Driven (Implementation is primary constraint)
Use when: API updates, backend changes, performance improvements
Flow: orchestrator → build-* → qa-risk → comms-delivery

## Agent Skill Assignments

| Skill | Assigned Agents |
|-------|-----------------|
| `claude-code` SKILL.md | build-frontend, build-backend, claude-code |
| `coding-agent` SKILL.md | codex (external Codex) |
| User research playbook | user-research |
| Design system playbook | ux-design |
| Product strategy playbook | product-strategy |

## Concurrency for Design Work

- **Discovery phase**: 2-3 agents (product-strategy + user-research + intelligence)
- **Design phase**: 2 agents (ux-design + user-research for validation)
- **Build phase**: 2-3 agents (build-frontend + build-backend + qa-risk)
- **Total design stream**: 6-7 agents (fits within max concurrent)

## Success Metrics

- Design-to-build handoff time
- Usability test pass rate
- Design implementation fidelity
- User satisfaction scores
- Time from research insights to shipped feature

---

Related: `SYSTEM_AGENT_REGISTRY.md`, `PERMANENT_SUBAGENT_ROSTER.md`, `org/PRODUCT_PROCESS.md`
