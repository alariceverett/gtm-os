# System Agent Registry (Forge Configuration)

_Last updated: 2026-02-23 23:45 ET_

This document maps the Permanent Subagent Roster roles to actual OpenClaw agents, enabling delegation and swarm operations.

**Status**: ✅ 18 agents configured with Kimi k2.5

## Agent Inventory

All agents use **Kimi k2.5** model unless specified otherwise.

| Agent ID | Roster Role | Type | Model |
|----------|-------------|------|-------|
| **LEAD AGENTS** ||||
| `orchestrator` | Orchestrator Lead | Lead | ollama/kimi-k2.5:cloud |
| `product-strategy` | Product Strategy Lead | Lead | ollama/kimi-k2.5:cloud |
| **DESIGN & UX TEAM** ||||
| `ux-design` | UX/UI Design Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `user-research` | User Research Specialist | Specialist | ollama/kimi-k2.5:cloud |
| **INTELLIGENCE TEAM** ||||
| `intelligence` | Intelligence Layer Lead | Lead | ollama/kimi-k2.5:cloud |
| `research` | Research & Verification Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `data-analytics` | Data & Analytics Specialist | Specialist | ollama/kimi-k2.5:cloud |
| **BUILD TEAM** ||||
| `claude-code` | Code & Automation Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `build-frontend` | Frontend Build Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `build-backend` | Backend Build Specialist | Specialist | ollama/kimi-k2.5:cloud |
| **QA & OPERATIONS** ||||
| `qa-risk` | QA & Risk Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `ops-runner` | Ops Runner Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `tooling-env` | Tooling & Environment Specialist | Specialist | ollama/kimi-k2.5:cloud |
| **DELIVERY** ||||
| `docs-knowledge` | Docs & Knowledge Specialist | Specialist | ollama/kimi-k2.5:cloud |
| `comms-delivery` | Comms & Delivery Specialist | Specialist | ollama/kimi-k2.5:cloud |
| **EXTERNAL TOOLS** ||||
| `codex` | External Codex Agent | Tool | ollama/kimi-k2.5:cloud |
| `pi` | External Pi Agent | Tool | ollama/kimi-k2.5:cloud |

## Agent States

```bash
# Check agent status
openclaw agents list
```

## Default Delegation Targets

### New Product/Feature (UX-First Flow)
```
product-strategy (brief/objectives)
    ↓
user-research → ux-design (parallel research + design exploration)
    ↓
build-frontend / build-backend (implementation)
    ↓
qa-risk / qa-risk (validation)
    ↓
comms-delivery (launch comms)
```

### AdZeta GTM Command Center
- **Primary**: `orchestrator` → routes to specialists
- **Intelligence**: `intelligence`
- **Implementation**: `claude-code` / `build-frontend` / `build-backend`
- **Data/KPI**: `data-analytics`
- **Testing**: `qa-risk`
- **Documentation**: `docs-knowledge`
- **Reporting**: `comms-delivery`
- **Queue Operations**: `ops-runner`
- **Tool Issues**: `tooling-env`

### Restaurant App
- **Primary**: `orchestrator` / `product-strategy`
- **Design**: `ux-design` + `user-research`
- **Implementation**: `build-frontend` + `build-backend`
- **Testing**: `qa-risk`

### Research Tasks
- **Primary**: `research` / `user-research`
- **Insights**: `intelligence`
- **Delivery**: `comms-delivery`

## Handoff Contract

All sub-agent spawns **must** include:

```json
{
  "agentId": "TARGET_AGENT",
  "task": "WHAT/WHY/CONSTRAINTS",
  "label": "descriptive-label",
  "thread": true,
  "mode": "run" | "session",
  "model": "ollama/kimi-k2.5:cloud"
}
```

Handoff packet attached to task must include:
- Artifact ID(s)
- Done definition check
- Assumptions
- Open risks
- Validation status
- Confidence level
- Requested next action

## Downstream Spawn Rules

| Initiator | May Spawn | Conditions |
|-----------|-----------|------------|
| `orchestrator` | Any agent | Always approved |
| `product-strategy` | `user-research`, `ux-design`, `intelligence` | Discovery, design, insights |
| `intelligence` | `research`, `data-analytics` | Evidence gathering, metrics |
| `user-research` | `ux-design`, `docs-knowledge` | Design iteration, findings doc |
| `ux-design` | `build-frontend`, `user-research` | Prototype build, validation |
| `build-frontend` | `build-backend`, `qa-risk` | API integration, testing |
| `build-backend` | `build-frontend`, `qa-risk` | Frontend sync, testing |
| `claude-code` | `qa-risk`, `tooling-env` | Validation needed, env blocked |
| `data-analytics` | `qa-risk`, `claude-code` | Metric validation, data scripts |
| `research` | `docs-knowledge`, `qa-risk` | Packaging, claim sensitivity |
| `ops-runner` | `tooling-env`, `qa-risk` | Runner failure, incident severity |
| `docs-knowledge` | `comms-delivery` | Final audience shaping |

**Requires Orchestrator approval:**
- 3+ downstream spawns
- External action risk
- Scope shift (implementation → strategy)

## Quality Gates

All sub-agents enforce:
- `org/EXCELLENCE_PREAMBLE_V1.md` quality standards
- `org/AGENT_CONTEXT_CONTRACT.md` handoff schema
- `org/SWARM_QUALITY_STACK.md` 8 required gates
- `org/SWARM_OUTPUT_ACCELERATOR.md` 14 practices

## Maximum Concurrency

| Level | Limit |
|-------|-------|
| System default agents | 6 concurrent |
| Sub-agents total | 12 concurrent |
| Target active chains | 6 |
| **Total Agents Configured** | **18 agents** |

### Concurrency by Team
| Team | Concurrent Limit | Agents |
|------|------------------|--------|
| Design/UX | 3-4 | product-strategy, user-research, ux-design, build-* |
| Intelligence | 2-3 | intelligence, research, data-analytics |
| Build | 3-4 | build-*, claude-code |
| QA/Ops | 2-3 | qa-risk, ops-runner, tooling-env |
| Delivery | 1-2 | comms-delivery, docs-knowledge |

## Restart Requirements

When updating this file, restart gateway:
```bash
openclaw gateway restart
```

## Related Documents

- `PERMANENT_SUBAGENT_ROSTER.md` — Role definitions
- `ROLE_PLAYBOOKS.md` — Operator procedures per role
- `AGENTS.md` — Agent identity and persona
