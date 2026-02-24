# AdZeta GTM Operating System — Strategy & Architecture

_Version: 1.0_  
_Date: 2026-02-24_  
_Status: ACTIVE DEVELOPMENT_

---

## Executive Summary

The AdZeta GTM Operating System (GTM-OS) is not a dashboard. It is an **autonomous, self-learning command center** that:

1. **Surfaces only relevant information** — Context-aware, user-personalized, action-prioritized
2. **Enables bidirectional communication** — User feedback → system learning → autonomous improvement
3. **Operates with minimal human intervention** — Reinforcement learning pipeline that evolves the OS
4. **Maintains world-class UX** — Linear × Vercel × Notion quality standards

**Core Philosophy:** The system should feel like having an elite GTM analyst who knows your business, anticipates your needs, and continuously improves — without explicit programming.

---

## 1. System Architecture

### 1.1 Three-Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: AUTONOMOUS INTELLIGENCE                                │
│  - Reinforcement learning engine                                 │
│  - Self-improving algorithms                                     │
│  - Predictive capabilities                                       │
│  - Minimal human configuration                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: OPERATIONAL CORE (Current Implementation)              │
│  - KPI telemetry & monitoring                                   │
│  - Work queue orchestration                                     │
│  - Process automation                                           │
│  - Backend integrations (Supabase/Postgres)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: USER INTERFACE (What users see/touch)                  │
│  - Personalized dashboard                                        │
│  - Voice/text input for feedback                               │
│  - Contextual action suggestions                              │
│  - Dark mode, accessibility, responsive                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Architecture

```
User Input (Voice/Text/Gesture)
    ↓
[Intent Classification + Context Analysis]
    ↓
┌─────────────────────────────┐    ┌──────────────────────────────┐
│ IMMEDIATE Response         │    │ LEARNING Pipeline           │
│ - Acknowledge              │    │ - Store feedback signal      │
│ - Execute (if actionable)  │    │ - Correlate with outcome     │
│ - Queue (if deferred)      │    │ - Update preference model    │
└─────────────────────────────┘    │ - Trigger improvement loop │
    ↓                              └──────────────────────────────┘
[State Update]
    ↓
[UI Refresh] (Personalized by preference model)
    ↓
User observes outcome → New feedback → Continues cycle
```

### 1.3 Preference Learning System

**Core Mechanism:** Every interaction teaches the system.

| Signal Source | What It Teaches | How It Affects UI |
|--------------|-----------------|-------------------|
| **Click patterns** | Which metrics user cares about | Reorder dashboard cards |
| **Time spent** | Which sections get attention | Expand/collapse by default |
| **Feedback voice notes** | Strategic preferences | Adjust language, tone |
| **Action completion** | What works vs what doesn't | Prioritize high-success paths |
| **Query patterns** | What user asks for | Add quick-access shortcuts |
| **Error recovery** | Where user gets stuck | Improve UX, add guardrails |

**Feedback Types:**
```typescript
type FeedbackSignal = {
  timestamp: ISO8601;
  user_id: string;
  context: {
    page: string;
    section: string;
    previous_actions: Action[];
  };
  signal_type: 
    | 'explicit_positive'    // Thumbs up, "this works"
    | 'explicit_negative'    // Thumbs down, critique
    | 'implicit_dwell'       // Time spent (> threshold)
    | 'implicit_skip'        // Quick dismissal
    | 'command_issued'       // Voice/text instruction
    | 'override_taken'       // User changed system suggestion
    | 'question_asked';      // Indicates confusion/curiosity
  content?: string;          // Text or transcript
  outcome?: Outcome;         // What happened after
  metadata: {
    session_duration: number;
    ui_state: UIStateSnapshot;
  };
};
```

---

## 2. Backend Infrastructure Utilization

### 2.1 Capabilities Inventory (Current → Extended)

| Backend System | Current Use | GTM-OS Extension |
|---------------|-------------|------------------|
| **KPI Telemetry** (`/api/kpis`) | Display metrics | Predictive alerting, trend forecasting |
| **Work Queue** (`WORK_QUEUE.md`) | Task tracking | Autonomous prioritization, block prediction |
| **Operator Tasks** (`cc_operator_tasks`) | Manual assignment | AI-driven task creation, auto-assignment |
| **Qualified Accounts** (`.run/reports/`) | Static lists | Dynamic scoring, nurture triggers |
| **Preference Profiles** (`.run/preferences/`) | Basic tracking | Deep personalization, cohort learning |
| **Daily GTM Summary** | Report generation | Predictive insights, anomaly detection |
| **Design Token Drift** | UI consistency | Auto-correction suggestions |
| **Monday Readiness** | Manual checklists | Predictive readiness scoring |
| **Alert Rules** | Static thresholds | Dynamic threshold learning |
| **Nurture Triggers** | Rule-based | ML-based optimization |

### 2.2 New Data Stores Required

```sql
-- Feedback signals for reinforcement learning
CREATE TABLE feedback_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  signal_type feedback_type_enum NOT NULL,
  context JSONB NOT NULL,
  content TEXT,
  outcome JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  learning_weight FLOAT DEFAULT 1.0
);

-- User preference models (learned, not configured)
CREATE TABLE preference_models (
  user_id TEXT PRIMARY KEY,
  model_version INT DEFAULT 1,
  feature_weights JSONB NOT NULL,      -- What matters to this user
  ui_config JSONB NOT NULL,            -- Personalized layout
  prediction_accuracy FLOAT,           -- How well model predicts user
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  training_examples INT DEFAULT 0   -- Signal count
);

-- Outcome ledger (for reinforcement)
CREATE TABLE outcome_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_taken JSONB NOT NULL,
  outcome_value FLOAT NOT NULL,        -- Normalized -1 to 1
  outcome_type outcome_enum NOT NULL,
  feedback_id UUID REFERENCES feedback_signals(id),
  learning_applied BOOLEAN DEFAULT false
);

-- Autonomous decisions log
CREATE TABLE autonomous_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,
  input_context JSONB NOT NULL,
  decision_made JSONB NOT NULL,
  confidence FLOAT NOT NULL,
  human_override BOOLEAN,
  override_reason TEXT,
  outcome FLOAT,                       -- Measured later
  approved_pre_autonomy BOOLEAN        -- If true, system can act alone
);
```

---

## 3. User Experience Design

### 3.1 Information Architecture

**Principle: Progressive Disclosure**

```
Level 1 (Immediate): Health & Priority → Action
┌─────────────────────────────────────────────────────────┐
│ GTM Health: 🟢 STRONG              [+ Quick Action]   │
│                                                         │
│ Priority: Review Q1 pipeline — 3 deals at risk        │
│ [View Details] [Acknowledge] [Delegate to AI]          │
└─────────────────────────────────────────────────────────┘

Level 2 (On Demand): Context & Detail
┌─────────────────────────────────────────────────────────┐
│ [Expanded Context for Priority #1]                        │
│ • Which deals? (list)                                   │
│ • Why at risk? (intelligence synthesis)                 │
│ • Suggested actions? (AI recommendations)              │
│ • What's worked before? (historical patterns)          │
└─────────────────────────────────────────────────────────┘

Level 3 (Deep Dive): Full Analysis
┌─────────────────────────────────────────────────────────┐
│ [Comprehensive Dashboard — All Metrics]                 │
│ • KPI drill-downs                                       │
│ • Trend analysis                                        │
│ • Comparative benchmarks                                │
│ • Raw data access                                       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Voice/Text Input System

**Core Loop:**

1. **Input:** User speaks or types
   - "Our demo conversion rate is dropping"
   - "Schedule demos with top 10 accounts this week"
   - "Why is ACME Corp in nurturing instead of qualified?"

2. **Intent Classification:**
   ```
   QUERY → Information retrieval
   COMMAND → Execute action
   ANALYSIS → Deep investigation
   FEEDBACK → Learning signal
   ```

3. **Context Assembly:**
   - Current user preference model
   - Recently viewed sections
   - Active objectives
   - Historical patterns

4. **Response:**
   - Immediate action (if executable)
   - Acknowledgment + ETA (if deferred)
   - Clarification questions (if ambiguous)
   - Learning confirmation (if feedback)

### 3.3 Quality Gates (Design Excellence)

**Every UI element must pass:**

| Gate | Question | Verification |
|------|----------|---------------|
| **Clarity** | Does this make sense in 5 seconds? | Heuristic review |
| **Relevance** | Is this the most important thing right now? | User testing, metrics |
| **Actionability** | Can user act on this immediately? | Task completion rate |
| **Learning** | Does this teach the system something? | Feedback capture |
| **Accessibility** | Can everyone use this? | WCAG 2.1 AA audit |
| **Performance** | Does this feel instant? | <100ms interaction feedback |
| **Aesthetics** | Is this beautiful enough to enjoy using? | Design review |

---

## 4. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Operational excellence with current capabilities

**Deliverables:**
- [ ] Solidified homepage (DONE ✓ needs refinement)
- [ ] Voice input MVP
- [ ] Basic feedback capture
- [ ] User preference profiles
- [ ] Personalized dashboard

**Quality Gates:**
- All current backend APIs consumed
- <2s page load on mobile 3G
- Zero critical accessibility violations
- 90%+ task completion rate

### Phase 2: Learning Core (Week 3-4)
**Goal:** System begins learning from user behavior

**Deliverables:**
- [ ] Feedback signal pipeline
- [ ] Preference model training
- [ ] UI personalization engine
- [ ] Outcome tracking
- [ ] First autonomous suggestions

**Quality Gates:**
- 10+ training examples per user
- Preference predictions >70% accuracy
- No catastrophic learning failures

### Phase 3: Intelligence Layer (Week 5-6)
**Goal:** Predictive and prescriptive capabilities

**Deliverables:**
- [ ] Predictive KPI alerting
- [ ] Anomaly detection
- [ ] Auto-prioritized work queue
- [ ] Intelligent task suggestions
- [ ] Pattern recognition

**Quality Gates:**
- Predictions validated against outcomes
- User approval rate >80%
- False positive rate <20%

### Phase 4: Autonomy (Week 7-8)
**Goal:** Minimal human intervention for routine operations

**Deliverables:**
- [ ] Auto-executing routine tasks
- [ ] Self-adjusting thresholds
- [ ] Autonomous optimization loops
- [ ] Human-in-the-loop for decisions
- [ ] Continuous learning cycle

**Quality Gates:**
- Autonomous actions successful >95%
- Human oversight required <10% of operations
- System shows measurable improvement week-over-week

---

## 5. Reinforcement Learning Architecture

### 5.1 The Learning Loop

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   OBSERVE   │────▶│   DECIDE     │────▶│    ACT       │
│  User state │     │ UI config    │     │  Render UI   │
│  Context    │     │ Suggestions  │     │  Execute cmd │
│  History    │     │ Predictions  │     │  Queue task  │
└─────────────┘     └──────────────┘     └──────────────┘
       ▲                                          │
       │                                          │
       │          ┌──────────────┐              │
       │          │    LEARN     │◄─────────────┘
       └──────────│  Update model│
                  │  Store signal│
                  └──────────────┘
```

### 5.2 Learning Types

| Type | What | Example | Frequency |
|------|------|---------|-----------|
| **Supervised** | Labeled examples | "This insight was helpful" | Continuous |
| **Reinforcement** | Reward outcomes | Task completion after suggestion | Per-action |
| **Unsupervised** | Pattern discovery | User cohorts with similar workflows | Periodic |
| **Transfer** | Cross-user learning | "Users like you also prefer..." | Daily batch |

### 5.3 Safety Mechanisms

**The system will NOT:**
- Make destructive changes without human approval
- Override explicit user preferences
- Learn from one-off errors
- Autonomously modify core business logic
- Hide information to simplify (only reorder)

**The system WILL:**
- Ask permission for high-impact changes
- Maintain "manual override" for everything
- Log all autonomous decisions
- Show "why" for every suggestion
- Degrade gracefully if learning fails

---

## 6. Success Metrics

### 6.1 User Experience
- **Time to insight:** <30 seconds from login
- **Action completion rate:** >90%
- **User satisfaction:** Self-reported, target NPS >50
- **Learning rate:** System shows measurable improvement weekly

### 6.2 Operational
- **Autonomous operations:** % of routine tasks requiring zero human input
- **Prediction accuracy:** % of suggestions user accepts
- **False positive rate:** % of suggestions user rejects
- **Feedback utilization:** % of user signals incorporated

### 6.3 Business
- **GTM velocity:** Time from objective → action → outcome
- **Decision quality:** Outcome quality of system-assisted vs manual decisions
- **Operator efficiency:** Actions per hour

---

## 7. Next Steps

### Immediate Actions
1. **Refine current homepage** based on this strategy
2. **Implement feedback capture** in UI
3. **Create preference model** data structure
4. **Design voice input system** architecture

### Pending Decisions
- [ ] Autonomy threshold: When can system act without approval?
- [ ] Learning boundaries: What should system NEVER learn?
- [ ] Feedback mechanisms: Beyond voice/text?
- [ ] Multi-user: How do cohort learnings apply?

### Quality Gates Before Next Phase
- [ ] Current homepage passes all 7 design gates
- [ ] Backend feedback pipeline operational
- [ ] Preference model can be trained
- [ ] Voice input captures and processes correctly

---

**Document Status:** Draft v1.0 — Ready for review and implementation

**Related Documents:**
- `SYSTEM_AGENT_REGISTRY.md` — Agent operations
- `DESIGN_HIERARCHY.md` — UX patterns
- `KPI_HIERARCHY_AND_DASHBOARD_IA.md` — Data architecture
- `DATA_CONTRACT_EVENT_SCHEMA_V1.md` — Event schema
