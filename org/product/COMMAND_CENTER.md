# Command Center — Your Executive Control Panel

> **Run the business from one screen.** The Command Center gives you a live view of work, decisions, approvals, and team communication.

## Why This Exists

Most AI tools stop at chat. Forge gives you an operating system for your organization. The Command Center helps you see what is happening, decide quickly, and move work forward.

---

## Layout: 3 Main Areas

```
┌──────────┬─────────────────────────────────┬──────────┐
│          │                                  │          │
│  Left    │        Main Workspace            │  Right   │
│  Rail    │                                  │  Panel   │
│          │   (Office Floor / Work Board /   │ (Comms)  │
│  Nav     │    Decisions / Metrics / etc.)   │          │
│  240px   │                                  │  320px   │
│          │                                  │          │
├──────────┴─────────────────────────────────┬┴──────────┤
│                   Status Bar               │ ⌘K        │
└────────────────────────────────────────────┴───────────┘
```

### Left Rail — Navigate Fast
**Helper text:** Use this rail to jump to any workspace and see what needs your attention now.

- **View switcher** — Office Floor, Decision Map, Work Board, Approvals, Metrics, Activity, Settings
- **Tabs** — keep multiple views open like browser tabs
- **Org status** — active agents, pending approvals, system health
- Collapsible to icon-only mode on smaller screens

### Main Workspace — Do the Work
**Helper text:** Open a view, review context, and take action without leaving the page.

The center panel shows your active view and supports tabs so you can compare multiple workflows side by side.

### Right Panel — Communicate and Respond
**Helper text:** Stay aligned with your team by handling updates, alerts, and threaded discussion in one place.

- **Messages** — direct updates between you and the organization
- **Alerts** — completions, exceptions, and important events
- **Comments** — discussion tied to tasks, decisions, and approvals
- Collapsible, slides in as a drawer on mobile

---

## Default Views

Every Forge instance includes these views out of the box:

### 🏢 Office Floor
**Helper text:** See who is working on what right now, then click any agent to follow up.

A 3D view of your AI organization in motion. Track activity in real time, open agent details, and identify bottlenecks quickly.

→ Full spec: [OFFICE_FLOOR.md](OFFICE_FLOOR.md)

### 🌳 Decision Map
**Helper text:** Review key decisions, understand why they were made, and unblock stalled items.

Visual flow of decisions and dependencies, color-coded by status (pending / active / complete / blocked).

**Data source:** `cc_decisions` table — written by `record_decision.js`

### 📋 Work Board
**Helper text:** Move work from planned to finished and spot blockers before they slow delivery.

Kanban board with four columns: **To Do → In Progress → In Review → Done**. Cards show owner, priority, due date, and blockers.

**Data source:** `cc_delegations` table — written by `record_delegation.js`

### ✅ Approvals
**Helper text:** Make fast, informed approvals on high-impact requests.

Single queue for anything requiring sign-off (high-authority decisions, deployments, budget changes, strategy shifts). Each item includes context, requester, urgency, and clear actions:

- **Approve request**
- **Reject request**

**Data source:** `cc_decisions` where `requires_approval = true`

### 📊 Metrics
**Helper text:** Track business performance and act early when trends shift.

Default KPI cards:
- **Revenue** — total and trend
- **Costs** — infrastructure, API, operations
- **Margins** — gross and net
- **Throughput** — decisions/day, tasks completed/day, cycle time
- **Quality** — process compliance %, error rate

Cards are customizable so you can add any metric your team tracks.

### 📡 Activity
**Helper text:** Scan a live timeline of work, then open any event for full context.

Chronological feed across the organization: decisions, assignments, process runs, approvals, and outcomes. Filter by team, agent, or event type.

**Data source:** Aggregated from all `cc_*` tables

### ⚙️ Settings
**Helper text:** Configure schedules, models, and organization preferences.

- **Manage schedules** — view, enable/disable, and edit recurring jobs
- **Set model policy** — assign models by workload tier and track usage
- **Update org settings** — organization name, divisions, feature toggles

---

## Command Bar (⌘K)

Press `⌘K` (or `Ctrl+K`) from anywhere to open the command bar.

- **Go to view** — jump to any workspace
- **Find agent** — locate an agent and open status
- **Find decision** — search decision history
- **Find task** — search by task name or ID
- **Run action** — create task, record decision, send message, approve item

Built with [cmdk](https://cmdk.paco.me/).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command bar |
| `⌘1–7` | Switch views (Office, Decisions, Work, Approvals, Metrics, Activity, Settings) |
| `⌘[` / `⌘]` | Previous / next tab |
| `⌘W` | Close current tab |
| `⌘.` | Toggle right panel |
| `⌘\` | Toggle left rail |
| `Escape` | Close modal / command bar |
| `?` | Show keyboard shortcuts |

---

## Data Layer

The Command Center uses **Supabase** for persistence. Views read and write these tables:

| Table | Purpose |
|-------|---------|
| `cc_decisions` | Decision records with status, authority level, reasoning |
| `cc_delegations` | Work assignments with owner, status, due date |
| `cc_messages` | Asynchronous communication (you ↔ org) |
| `cc_priorities` | Prioritized work items with urgency scoring |
| `cc_steps` | Reasoning steps linked to decisions |
| `cc_process_runs` | Process execution tracking with timing and ratings |
| `cc_prompt_versions` | Prompt evolution history |
| `cc_learnings` | Organizational learnings from after-action reviews |

**API layer:** Two Supabase Edge Functions handle all data access:
- **`cc-read`** — authenticated read access with RLS
- **`cc-write`** — authenticated write access with validation

See [CC_SETUP_GUIDE.md](CC_SETUP_GUIDE.md) for full schema and setup steps.

---

## Tech Stack

| Component | Library | Why |
|-----------|---------|-----|
| 3D rendering | Three.js + @react-three/fiber + @react-three/drei | Office Floor |
| Flow diagrams | @xyflow/react (React Flow) | Decision Map |
| Kanban | @dnd-kit/core + @dnd-kit/sortable | Work Board |
| Command bar | cmdk | Keyboard command palette |
| State management | zustand | Lightweight state |
| Charts | recharts or visx | KPI sparklines |
| Data | Supabase (PostgreSQL + Realtime) | Persistence + live updates |

---

## Live Updates

The Command Center subscribes to Supabase Realtime channels:

- **Decisions** — new items appear immediately in Decision Map
- **Assignments** — status changes update Work Board and Office Floor
- **Messages** — communication panel refreshes live
- **Agent status** — Office Floor activity updates as work changes

No manual refresh required.

---

*The Command Center is available as a separate starter package. This doc explains the product and workflow. See [CC_SETUP_GUIDE.md](CC_SETUP_GUIDE.md) for implementation details.*