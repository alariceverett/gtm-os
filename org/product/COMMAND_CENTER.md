# Command Center — Forge's Operating UI

> **The Command Center (CC) is how you see, steer, and interact with your AI organization.** It's the default dashboard that ships with every Forge instance — a real-time operating interface, not just a chat window.

## Why This Exists

Most AI tools give you a chat box. Forge gives you an **organization**. The Command Center is how you run it: watch your agents work in 3D, approve decisions, track tasks, monitor metrics, and communicate — all from one screen.

---

## Architecture: 3-Zone Layout

```
┌──────────┬─────────────────────────────────┬──────────┐
│          │                                  │          │
│  Left    │        Main Workspace            │  Right   │
│  Rail    │                                  │  Panel   │
│          │   (Office Floor / Task Board /   │ (Comms)  │
│  Nav     │    Decisions / Metrics / etc.)   │          │
│  240px   │                                  │  320px   │
│          │                                  │          │
├──────────┴─────────────────────────────────┬┴──────────┤
│                   Status Bar               │ ⌘K        │
└────────────────────────────────────────────┴───────────┘
```

### Left Rail — Navigation

- **View switcher** — Office Floor, Decision Tree, Task Board, Approvals, Metrics, Activity, Config
- **Tabbed workspace** — open multiple views like browser tabs
- **Org status** — active agents count, pending approvals badge, system health
- Collapsible to icon-only mode on smaller screens

### Main Workspace — Where the Work Happens

The central area renders the active view. Supports tabbed navigation so you can keep multiple views open simultaneously.

### Right Panel — Communications

- **Messages** — async comms between you and the org
- **Notifications** — system events, completions, alerts
- **Comments** — inline discussion on decisions, tasks, approvals
- Collapsible, slides in as a drawer on mobile

---

## Default Views

Every Forge instance ships with these views ready to go:

### 🏢 Office Floor
**The flagship view.** A 3D visualization of your AI org at work, built with Three.js. Watch agents move between zones, see who's working on what, click any agent for details. This is what makes Forge feel alive.

→ Full spec: [OFFICE_FLOOR.md](OFFICE_FLOOR.md)

### 🌳 Decision Tree
Visual decision flow powered by React Flow. See every decision your org has made, its status, relationships, and delegations. Nodes are color-coded by status (pending/active/complete/blocked). Zoom, pan, and click any node for full context.

**Data source:** `cc_decisions` table — flows from `record_decision.js`

### 📋 Task Board
Kanban board built with dnd-kit. Four columns: **Todo → Active → Review → Done**. Cards show assignee, priority, deadline, and blockers. Drag to reorder or move between states.

**Data source:** `cc_delegations` table — tasks created via `record_delegation.js`

### ✅ Approvals
Unified feed of everything that needs your sign-off. Decisions above the agent's authority, deployments, budget items, strategy changes. Each item shows context, the requesting agent, urgency, and one-click approve/reject.

**Data source:** `cc_decisions` where `requires_approval = true`

### 📊 Metrics Dashboard
KPI cards with sparklines. Default metrics:
- **Revenue** — total and trend
- **Costs** — infrastructure, API, operational
- **Margins** — gross and net
- **Throughput** — decisions/day, tasks completed/day, cycle time
- **Quality** — process compliance %, error rate

Cards are customizable — add any metric your org tracks.

### 📡 Activity Stream
Chronological feed of everything happening in the org. Decision made, task delegated, process started, skill built, approval requested. Filterable by division, agent, event type. Your audit trail.

**Data source:** Aggregated from all `cc_*` tables

### ⚙️ Config
- **Cron management** — view, enable/disable, edit schedules for all org crons
- **Model configuration** — tier assignments, usage tracking
- **Settings** — org name, divisions, feature toggles

---

## Command Bar (⌘K)

Press `⌘K` (or `Ctrl+K`) anywhere to open the command bar. Fuzzy search across:

- **Views** — jump to any view instantly
- **Agents** — find an agent, see their status
- **Decisions** — search decision history
- **Tasks** — find a task by name or ID
- **Actions** — create task, record decision, send message, approve item

Built with [cmdk](https://cmdk.paco.me/).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command bar |
| `⌘1–7` | Switch to view 1–7 (Office, Decisions, Tasks, Approvals, Metrics, Activity, Config) |
| `⌘[` / `⌘]` | Previous / next tab |
| `⌘W` | Close current tab |
| `⌘.` | Toggle right panel |
| `⌘\` | Toggle left rail |
| `Escape` | Close modal / command bar |
| `?` | Show keyboard shortcuts |

---

## Data Layer

The Command Center requires **Supabase** for data persistence. All views read from and write to these tables:

| Table | Purpose |
|-------|---------|
| `cc_decisions` | Decision records with status, authority level, reasoning |
| `cc_delegations` | Task assignments with assignee, status, deadline |
| `cc_messages` | Async communications (you ↔ org) |
| `cc_priorities` | Priority queue items with urgency scoring |
| `cc_steps` | Reasoning steps linked to decisions |
| `cc_process_runs` | Process execution tracking with timing and ratings |
| `cc_prompt_versions` | Prompt evolution history |
| `cc_learnings` | Organizational learnings from after-actions |

**API layer:** Two Supabase Edge Functions handle all CC data:
- **`cc-read`** — authenticated read access with RLS
- **`cc-write`** — authenticated write access with validation

See [CC_SETUP_GUIDE.md](CC_SETUP_GUIDE.md) for the full schema and setup steps.

---

## Tech Stack

| Component | Library | Why |
|-----------|---------|-----|
| 3D rendering | Three.js + @react-three/fiber + @react-three/drei | Office Floor |
| Flow diagrams | @xyflow/react (React Flow) | Decision Tree |
| Kanban | @dnd-kit/core + @dnd-kit/sortable | Task Board |
| Command bar | cmdk | ⌘K palette |
| State management | zustand | Lightweight, no boilerplate |
| Charts | recharts or visx | Metrics sparklines |
| Data | Supabase (PostgreSQL + Realtime) | Persistence + live updates |

---

## Real-time Updates

The CC subscribes to Supabase Realtime channels for live data:

- **Decisions** — new decisions appear instantly in Decision Tree
- **Delegations** — task status changes reflect on Task Board and Office Floor
- **Messages** — comms panel updates in real-time
- **Agent status** — Office Floor agents change pose/activity as work happens

No polling. No refresh button. The org moves and the UI moves with it.

---

*The Command Center is available as a separate starter package. These docs describe what it is and how it works — see [CC_SETUP_GUIDE.md](CC_SETUP_GUIDE.md) to set it up.*
