# Office Floor — 3D AI Organization Visualization

> **Watch your AI org work.** The Office Floor renders your entire organization as a 3D scene — agents moving between zones, sitting at desks, presenting at whiteboards, shipping code. It's not a gimmick. It's situational awareness.

## What You See

A top-down (or orbit-able) 3D office space divided into zones — one per division. Each zone has:

- **Furniture** — desks, chairs, whiteboards, plants (visual anchoring)
- **Agent avatars** — stylized 3D figures representing each AI agent
- **Status indicators** — color-coded auras and pose animations showing what each agent is doing *right now*

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ╔══ CEO Zone ══╗           ╔══ Growth Zone ═══════╗   │
│   ║              ║           ║                      ║   │
│   ║   🧑‍💼 Bert    ║           ║  👩‍💻 Flora   📝 Mona  ║   │
│   ║  presenting  ║           ║  analyzing  writing  ║   │
│   ║              ║           ║         🚀 Rex       ║   │
│   ╚══════════════╝           ║        deploying     ║   │
│                              ╚══════════════════════╝   │
│          ┌─── Collaboration Zone ───┐                   │
│          │  🤝 Luna + Max (syncing) │                   │
│          └──────────────────────────┘                   │
│   ╔══ Ops Zone ═════╗       ╔══ Product Zone ═══════╗   │
│   ║                 ║       ║                       ║   │
│   ║  ⚙️ Ada  💤 Otto ║       ║  🎨 Pixel   📊 Sage   ║   │
│   ║  coding   idle  ║       ║  designing  presenting║   │
│   ╚═════════════════╝       ╚═══════════════════════╝   │
│                                                         │
│   ╔══ Security Zone ═╗                                  │
│   ║                  ║                                  │
│   ║  🔍 Knox  ✅ Vera ║                                  │
│   ║  scanning  done! ║                                  │
│   ╚══════════════════╝                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
OfficeFloor
├── Canvas (@react-three/fiber)
│   ├── OrbitControls (camera: orbit, zoom, pan)
│   ├── Lighting (ambient + directional)
│   └── OfficeScene
│       ├── Zone3D (per division)
│       │   ├── Floor plane (division color tint)
│       │   ├── Label (division name)
│       │   └── Furniture3D[]
│       │       ├── Desk
│       │       ├── Chair
│       │       ├── Whiteboard
│       │       └── Plant
│       └── Agent3D[] (per agent)
│           ├── Body (stylized figure mesh)
│           ├── Status aura (glowing ring, color = status)
│           ├── Name label (billboard text)
│           ├── Task tooltip (current task, on hover)
│           └── Pose animation (from 12-pose set)
├── Agent Detail Panel (HTML overlay, on click)
│   ├── Agent name, role, division
│   ├── Current task + status
│   ├── Recent decisions
│   └── Action buttons (message, assign, view history)
└── Controls overlay
    ├── Zoom buttons
    ├── Reset camera
    └── Toggle labels
```

---

## Agent Avatars

Each agent is rendered as a stylized 3D figure (low-poly humanoid). Agents display:

| Property | Source | Visual |
|----------|--------|--------|
| **Name** | Agent roster | Billboard text above head |
| **Role** | Agent roster | Subtitle text |
| **Division** | Agent config | Position in zone + color tint |
| **Status** | Live delegation data | Aura color + pose animation |
| **Current task** | Active delegation | Tooltip on hover |

### 12 Animation Poses

Agents transition between poses based on their current status:

| Pose | Status Trigger | Animation |
|------|---------------|-----------|
| `idle` | No active task | Standing, slight sway |
| `recon` | Researching, analyzing | Looking around, hand on chin |
| `building` | Coding, writing, designing | Seated at desk, typing |
| `presenting` | Reporting, demoing | Standing at whiteboard, gesturing |
| `deploying` | Deploying, shipping | Walking with purpose |
| `shipping` | Sending deliverables | Handing off motion |
| `winning` | Task completed successfully | Arms raised celebration |
| `meeting` | In sync/collaboration | Facing another agent |
| `thinking` | Planning, strategizing | Pacing, hand on chin |
| `reviewing` | QA, testing, reviewing | Examining gesture |
| `celebrating` | Major milestone | Jump + confetti particles |
| `coffeeBreak` | Paused, on break | Holding cup, relaxed stance |

### Status → Pose Mapping

```javascript
function mapStatusToPose(status) {
  if (!status) return 'idle'
  const s = status.toLowerCase()
  if (['pending', 'waiting', 'idle'].includes(s))          return 'idle'
  if (['researching', 'analyzing'].includes(s))             return 'recon'
  if (['active', 'executing', 'writing', 'coding'].includes(s)) return 'building'
  if (['reporting', 'presenting'].includes(s))              return 'presenting'
  if (['deploying'].includes(s))                            return 'deploying'
  if (['sending'].includes(s))                              return 'shipping'
  if (['complete', 'success'].includes(s))                  return 'winning'
  if (['meeting', 'syncing'].includes(s))                   return 'meeting'
  if (['thinking', 'strategizing', 'planning'].includes(s)) return 'thinking'
  if (['reviewing', 'qa', 'testing'].includes(s))           return 'reviewing'
  if (['celebrating', 'won'].includes(s))                   return 'celebrating'
  if (['break', 'coffee'].includes(s))                      return 'coffeeBreak'
  return 'idle'
}
```

---

## Division Zones

Each division occupies a region of the floor with a colored ground plane and label:

| Division | Default Color | Position |
|----------|--------------|----------|
| CEO | `#1C1917` | Top-left |
| Growth | `#15803D` | Top-right |
| Operations | `#DC4826` | Bottom-left |
| Product | `#B45309` | Bottom-right |
| Security | `#57534E` | Lower-left |

A **Collaboration Zone** sits in the center for agents in cross-team syncs.

Zones and positions are fully customizable — add divisions, rearrange the floor plan, change colors.

---

## Camera Controls

- **Orbit** — click + drag to rotate the scene
- **Zoom** — scroll wheel or pinch
- **Pan** — right-click + drag (or two-finger drag)
- **Reset** — button to snap back to default overhead view
- **Focus agent** — click an agent to smoothly zoom the camera to them

Powered by `OrbitControls` from @react-three/drei.

---

## Live Data Integration

The Office Floor isn't a static scene — it pulls real-time data from your Forge org:

| Data | Source | Updates |
|------|--------|---------|
| Agent roster | `cc_delegations` table (distinct agents) | On org change |
| Agent status | `cc_delegations.status` | Supabase Realtime |
| Current tasks | `cc_delegations.task` (active) | Supabase Realtime |
| Division layout | Org config / `DELEGATION_SYSTEM.md` | On config change |
| Decision activity | `cc_decisions` | Realtime (for presenting poses) |

When an agent's delegation status changes in the database, their avatar transitions to the corresponding pose within seconds. No refresh needed.

### Fallback: Mock Data

If Supabase isn't connected (or no delegations exist yet), the Office Floor renders with mock agents so the scene is never empty. This is great for demos and first impressions.

---

## Click Interaction

Click any agent → a detail panel slides in from the right:

```
┌─────────────────────────┐
│  🧑‍💼 Bert — CEO           │
│  Division: CEO           │
│  Status: Presenting      │
│                          │
│  Current Task:           │
│  Reviewing Q1 strategy   │
│                          │
│  Recent Decisions:       │
│  • DEC-042: Approve...   │
│  • DEC-041: Delegate...  │
│                          │
│  [💬 Message] [📋 Tasks]  │
│  [📊 History] [⚙️ Config] │
└─────────────────────────┘
```

---

## Performance

- **Target:** 60fps on mid-range hardware
- **Agent limit:** Tested with 50+ agents; LOD reduces detail at distance
- **Textures:** Low-poly style, minimal texture memory
- **Instancing:** Furniture uses instanced meshes for efficiency
- **Suspend:** Scene pauses rendering when tab is not visible

---

## Customization

Everything is configurable:

- **Division zones** — add, remove, rearrange, recolor
- **Agent models** — swap the default figures for custom avatars
- **Furniture** — add/remove/reposition
- **Floor texture** — change the ground material
- **Lighting** — mood/time-of-day presets
- **Poses** — add custom poses for domain-specific statuses

---

*The Office Floor is what makes Forge feel like a living organization, not a folder of markdown files. It's the first thing users see, and it sets the tone for everything else.*
