# AdZeta Homepage Redesign — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** 2026-02-24  
**Status:** Design Phase  
**Owner:** Product Strategy + UX Design Lead  
**Target Release:** MVP (Week 1), Polish (Week 2), Voice (Week 3)

---

## 1. Executive Summary

### Problem Statement
The current GTM Command Center "doesn't make sense" to users. It lacks clear information hierarchy, navigation is confusing, and there's no unified view of GTM motion health. CEOs/Founders cannot quickly assess:
- Overall GTM health status
- Key metrics at a glance
- Strategy execution progress
- What actions to take next

### Solution Vision
A world-class GTM Command Center homepage that delivers **clarity in <30 seconds**. The design prioritizes:
1. **Immediate status awareness** — health indicator + KPIs above the fold
2. **Clear action hierarchy** — what to do now vs. what to plan
3. **Unified strategy-to-execution view** — objectives connect to tasks
4. **Frictionless objective creation** — text + voice input with AI assistance

---

## 2. Target Persona

### Primary User: CEO/Founder Running GTM

**Demographics:**
- Role: CEO, Founder, Head of Revenue
- Company: B2B SaaS, 10-100 employees
- Technical: Moderate (can navigate dashboards but prefers simplicity)

**Goals:**
1. Know the health of GTM motion in under 30 seconds
2. Understand what's working/not working quickly
3. Create new strategic objectives with minimal friction
4. Feel in control of the entire GTM operation

**Pain Points:**
- Too many disconnected tools and dashboards
- Unclear which metrics matter most
- No clear connection between goals and day-to-day work
- Feels like flying blind on execution progress

**Success Criteria:**
- Can state GTM health without scrolling
- Can create a new objective in <10 seconds
- Can see progress on current goals instantly

---

## 3. Information Architecture Decisions

### Primary Navigation (Top-level)
| Route | Purpose | User Mental Model |
|-------|---------|-------------------|
| **Dashboard** (`/`) | GTM health + KPIs + quick actions | "How are we doing?" |
| **Objectives** (`/objectives`) | Strategic goals, OKRs, north stars | "What are we trying to achieve?" |
| **Execution** (`/execution`) | Tactical tasks, work-in-progress | "What work is happening?" |
| **Analytics** (`/analytics`) | Deep-dive reports, trends, diagnostics | "Why did that happen?" |
| **Settings** (`/settings`) | Configuration, integrations, team | "How do I configure things?" |

### Consolidation Decision
**Current routes to consolidate/migrate:**
- `/ops` → `/` (Dashboard) + `/analytics` (deep metrics)
- `/targeting`, `/actions`, `/relationships` → `/execution` (unified work view)
- `/strategy` → `/objectives` (strategic planning)
- `/comms`, `/pilot`, `/research` → Contextual panels within Execution/Analytics

**Rationale:**
- Reduces cognitive load from 9 routes to 5
- Creates clear conceptual buckets (why → what → how → insights → setup)
- Aligns with KPI hierarchy from `KPI_HIERARCHY_AND_DASHBOARD_IA.md`

---

## 4. Functional Requirements

### 4.1 GTM Status Dashboard (Hero Section)

**FR-DASH-001: Health Indicator**
- Display overall GTM health as 🟢 Green | 🟡 Yellow | 🔴 Red
- Logic based on: 
  - 🟢 All L1 KPIs on track
  - 🟡 1+ KPIs at risk (TTNHA > target, QA velocity declining)
  - 🔴 1+ KPIs failing (no qualified accounts in 48h, critical backlog)
- Position: Top-left hero, immediately visible

**FR-DASH-002: KPI Scorecard (L1 Metrics)**
Display 5 canonical KPIs per KPI_HIERARCHY:
1. **QA (Qualified Accounts)** — total count, 24h delta, trend
2. **PR (Positive Replies)** — today's count, trend
3. **Meetings** — today's scheduled count, trend
4. **PR/M Combined** — combined headline metric
5. **TTNHA (Time to Next Human Action)** — median, p90

**FR-DASH-003: Trend Indicators**
- Show ↗️ (up 5%+), ↘️ (down 5%+), → (flat within 5%) vs previous period
- Color: green (up/good), red (down/bad), gray (neutral)

**FR-DASH-004: Timeframe Selector**
- Options: Today | This Week | This Month
- Default: "This Week" (balances recency with context)
- Affects all KPIs in scorecard simultaneously
- Persist selection in localStorage

**FR-DASH-005: Evidence Quick-Links**
- Each KPI number is a link to evidence feed
- Click shows exact events that contributed to the number
- Implements proof-invariant from KPI document

### 4.2 Strategy + Execution View

**FR-STRAT-001: Active Objectives Panel**
- Display objectives from `/objectives` route inline on dashboard
- Show: title, progress %, status, owner, due date
- Limit: 3 most critical objectives (by priority + due date)
- CTA to see all objectives

**FR-EXEC-001: Today’s Execution Tasks**
- Display tasks from execution pipeline
- Columns/sections: 
  - 🔴 Needs Action (queued signals)
  - 🟡 In Progress (active work)
  - 🟢 Done Today
- Show: title, account, owner, priority
- Limit: 5 items per section with "Show All" link

**FR-EXEC-002: Quick Actions**
- Inline buttons on task rows: Start | Pause | Done
- Inline buttons on objectives: Update Progress | Mark Complete
- Confirmation not required for done (undo available)

**FR-EXEC-003: Ownership + Due Dates**
- Show avatar + name for owner
- Show relative dates: "Due today", "Due in 2 days", "Overdue 1 day"
- Color-code due dates: green (future), amber (today), red (overdue)

### 4.3 GTM Objectives Input (Prominent CTA)

**FR-INPUT-001: Text Input**
- Prominent input: placeholder "Create new objective..."
- Position: Below hero, full-width on mobile, 67% on desktop
- Auto-focus on page load (desktop only)

**FR-INPUT-002: Voice Input**
- Mic icon button to the right of text input
- Click activates browser SpeechRecognition API
- Shows visual feedback while listening (pulsing indicator)
- Transcribes to text input on completion

**FR-INPUT-003: AI Suggestion Chips**
- Below input: 2-3 context-aware suggestions
- Examples:
  - "Launch email sequence to 100 prospects"
  - "Schedule 5 demos this week"
  - "Follow up on Q1 pilot opportunities"
- Chips are one-click to populate input

**FR-INPUT-004: Smart Parsing**
- On submit, parse input for: target metric, timeframe, owner suggestion
- Example: "Schedule 5 demos this week" → metric: demos, target: 5, timeframe: 7 days
- Create objective draft with parsed fields pre-filled

### 4.4 Navigation Architecture

**FR-NAV-001: Primary Navigation**
- Sticky header with logo + nav items
- Items: Dashboard | Objectives | Execution | Analytics | Settings
- Active state: underline + subtle background
- Collapse to hamburger menu on mobile

**FR-NAV-002: Breadcrumbs**
- Show on all pages except Dashboard
- Format: Home > Section > Current Page
- Clickable ancestors

**FR-NAV-003: Contextual Help**
- (?)

 icons next to complex elements
- Hover/click shows tooltip explaining the metric or concept
- Links to full documentation for deep learning

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-PERF-001: Initial Load**
- First Contentful Paint (FCP): < 2 seconds
- Time to Interactive (TTI): < 3.5 seconds
- Lighthouse Performance score: > 90

**NFR-PERF-002: Data Loading**
- Show skeleton loaders immediately
- KPI data streams in progressively (cached first, fresh second)
- Evidence feed loads on-demand (lazy)

### 5.2 Accessibility

**NFR-A11Y-001: WCAG 2.1 AA Compliance**
- Color contrast ratio: 4.5:1 minimum for text
- Focus indicators visible on all interactive elements
- Keyboard navigation: full tab order support
- Screen reader labels for all icons and visual-only elements

**NFR-A11Y-002: Reduced Motion**
- Respect `prefers-reduced-motion` for animations
- Provide non-animated alternatives for all transitions

### 5.3 Responsive Design

**Breakpoints:**
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

**NFR-RESP-001: Mobile-First**
- Design mobile layout first, enhance for larger screens
- Touch targets: minimum 44px
- Swipe gestures for common actions (complete task, dismiss)

**NFR-RESP-002: Tablet Optimization**
- 2-column layout for KPI cards
- Side panel for execution tasks

**NFR-RESP-003: Desktop Enhancement**
- 3-column KPI layout
- Persistent side navigation (not hamburger)

### 5.4 Dark Mode

**NFR-DARK-001: System Preference Detection**
- Detect `prefers-color-scheme` on load
- Manual toggle available in Settings
- Persist preference in localStorage

**NFR-DARK-002: Color Palette**
- Dark: bg-slate-950, text-slate-100
- Muted: bg-slate-900, text-slate-400
- Health green: emerald-400, yellow: amber-400, red: rose-400

---

## 6. User Stories

### US-001: Morning Health Check
> As a CEO, I want to see GTM health immediately upon opening the app, so that I know if I need to take action today.

**Acceptance Criteria:**
- [ ] Health indicator visible without scrolling
- [ ] KPI numbers show today's/this week's status
- [ ] Trends indicate direction vs previous period
- [ ] Evidence links available for verification

### US-002: Quick Objective Creation
> As a CEO, I want to create a new strategic objective in under 10 seconds, so that I can capture ideas immediately.

**Acceptance Criteria:**
- [ ] Input field visible without scrolling
- [ ] Voice input available and functional
- [ ] AI suggestions relevant to current context
- [ ] Objective created with parsing suggestions

### US-003: Action Prioritization
> As a CEO, I want to see what needs my attention now, so that I can focus on the most important work.

**Acceptance Criteria:**
- [ ] "Needs Action" section visible
- [ ] Items sorted by urgency/priority
- [ ] Quick actions available inline
- [ ] Due dates are explicit and accurate

### US-004: Progress Visibility
> As a CEO, I want to see progress on current objectives, so that I can verify we're on track.

**Acceptance Criteria:**
- [ ] Active objectives visible on dashboard
- [ ] Progress bars show % complete
- [ ] Status badges clear and accurate
- [ ] Click-through to full objective details

### US-005: Evidence Verification
> As a CEO, I want to verify that KPI numbers are accurate, so that I can trust the data.

**Acceptance Criteria:**
- [ ] Every KPI number is clickable
- [ ] Click reveals contributing events
- [ ] Events link to external evidence
- [ ] Data quality indicators visible

### US-006: Mobile Awareness
> As a CEO, I want to check GTM status on my phone, so that I can stay informed anywhere.

**Acceptance Criteria:**
- [ ] All functionality works on mobile
- [ ] Layout adapts to small screens
- [ ] Touch interactions intuitive
- [ ] Performance acceptable on mobile networks

### US-007: Dark Mode Preference
> As a CEO, I want to use a dark mode interface, so that it's comfortable in low-light environments.

**Acceptance Criteria:**
- [ ] Dark mode follows system preference
- [ ] Manual toggle available
- [ ] All components render correctly in dark mode
- [ ] Contrast maintained at WCAG AA level

---

## 7. Success Metrics

### 7.1 Engagement Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Dashboard load rate | N/A | > 80% of sessions start here | Analytics |
| Time to first KPI view | TBD | < 2s | Performance API |
| Objective creation rate | TBD | +50% over baseline | Event tracking |
| Voice input usage | 0% | > 15% of objectives | Event tracking |

### 7.2 Usability Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Task completion rate | TBD | > 90% | UX testing |
| Error rate | TBD | < 5% | Error tracking |
| Time on task (create objective) | TBD | < 10s avg | Analytics |
| Bounce rate from Dashboard | TBD | < 20% | Analytics |

### 7.3 Technical Metrics
| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| First Contentful Paint | TBD | < 2s | Lighthouse |
| WCAG AA compliance | None | 100% | axe-core audit |
| Mobile usability score | TBD | > 90 | Lighthouse |
| Dark mode coverage | 0% | 100% | Code coverage |

---

## 8. Dependencies & Constraints

### 8.1 Technical Dependencies
- Existing event schema from `org/adzeta/DATA_CONTRACT_EVENT_SCHEMA_V1.md`
- KPI computation from `/api/metrics/snapshot` and related endpoints
- Research Ledger integration for evidence links
- User auth system (existing)

### 8.2 Constraints
- No backend changes (use existing APIs)
- Must integrate with `/ops` route (redirect or consolidate)
- Must respect existing KPI hierarchy
- Component-based architecture (React/TS/Tailwind)

### 8.3 Assumptions
- API latency < 500ms for KPI data
- Evidence links are available and valid
- User has necessary permissions to view all data
- Browser supports modern web APIs (SpeechRecognition optional)

---

## 9. Out of Scope

The following are explicitly NOT in scope for this redesign:

1. **Backend API changes** — Use existing endpoints only
2. **Real-time updates** — Polling-based refresh acceptable
3. **Advanced visualization** — Charts limited to trends (no complex dashboards)
4. **Collaboration features** — No comments, @mentions, or real-time collaboration
5. **Mobile app** — Web responsive only (no native app)
6. **Offline mode** — Online-only for MVP
7. **Advanced AI features** — Basic suggestion chips only (no generative planning)

---

## 10. Open Questions

1. **Health indicator logic:** Who defines the thresholds for red/yellow/green?
2. **Evidence links:** Are all evidence refs URLs, or some internal references?
3. **Voice recognition:** Do we use browser API or integrate with a service?
4. **AI suggestions:** Context from where? Historical objectives? Current goals?
5. **Notification integration:** Should alerts appear on Dashboard?
6. **Timezone handling:** All dates in user's timezone or UTC?

---

## 11. Approval & Sign-off

| Role | Name | Status | Date |
|------|------|--------|------|
| Product Strategy Lead | (TBD) | Pending | |
| UX Design Lead | (TBD) | Pending | |
| Engineering Lead | (TBD) | Pending | |
| CEO/Stakeholder | (TBD) | Pending | |

---

**Next Step:** Proceed to wireframe creation and component architecture design.
