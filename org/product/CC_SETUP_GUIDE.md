# Command Center — Setup Guide

> From zero to a running Command Center in your Forge instance.

## Prerequisites

- A running Forge instance (template already bootstrapped)
- Supabase project (free tier works)
- Node.js 18+

---

## Step 1: Install Dependencies

```bash
npm install react react-dom
npm install three @react-three/fiber @react-three/drei    # Office Floor (3D)
npm install @xyflow/react                                  # Decision Tree
npm install @dnd-kit/core @dnd-kit/sortable               # Task Board (Kanban)
npm install cmdk                                           # Command Bar (⌘K)
npm install zustand                                        # State management
npm install recharts                                       # Metrics sparklines
npm install @supabase/supabase-js                          # Data layer
```

**Full dependency list:**

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "@xyflow/react": "^12.0.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "cmdk": "^0.2.0",
    "zustand": "^4.4.0",
    "recharts": "^2.10.0",
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

---

## Step 2: Create Supabase Tables

Run this SQL in your Supabase SQL Editor (or via `psql`):

```sql
-- Decisions: every significant choice the org makes
CREATE TABLE cc_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, active, complete, blocked, rejected
  authority_level TEXT DEFAULT 'agent',  -- agent, lead, ceo, board
  requires_approval BOOLEAN DEFAULT false,
  decided_by TEXT,
  reasoning TEXT,
  outcome TEXT,
  parent_decision_id TEXT REFERENCES cc_decisions(decision_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Delegations: task assignments flowing through the org
CREATE TABLE cc_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id TEXT UNIQUE NOT NULL,
  decision_id TEXT REFERENCES cc_decisions(decision_id),
  task TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  division TEXT,
  status TEXT DEFAULT 'todo',  -- todo, active, review, done, blocked
  priority INTEGER DEFAULT 5,
  deadline TIMESTAMPTZ,
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Messages: async communication
CREATE TABLE cc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender TEXT NOT NULL,
  recipient TEXT,            -- null = broadcast
  channel TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'message',  -- message, notification, comment, alert
  reference_type TEXT,       -- decision, delegation, process
  reference_id TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Priorities: the priority queue
CREATE TABLE cc_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  urgency INTEGER DEFAULT 5,  -- 1-10
  importance INTEGER DEFAULT 5,  -- 1-10
  status TEXT DEFAULT 'active',
  owner TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Reasoning steps linked to decisions
CREATE TABLE cc_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id TEXT REFERENCES cc_decisions(decision_id),
  step_type TEXT DEFAULT 'thought',  -- thought, analysis, evidence, conclusion
  content TEXT NOT NULL,
  step_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Process execution tracking
CREATE TABLE cc_process_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT UNIQUE NOT NULL,
  process_id TEXT NOT NULL,
  status TEXT DEFAULT 'running',  -- running, complete, failed, cancelled
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rating INTEGER,  -- 1-5
  notes TEXT,
  org_id TEXT NOT NULL
);

-- Prompt version history
CREATE TABLE cc_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  prompt_text TEXT NOT NULL,
  performance_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Organizational learnings
CREATE TABLE cc_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT,  -- after-action, weekly-review, process-run
  source_id TEXT,
  lesson TEXT NOT NULL,
  category TEXT,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  org_id TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_decisions_status ON cc_decisions(status);
CREATE INDEX idx_decisions_org ON cc_decisions(org_id);
CREATE INDEX idx_delegations_status ON cc_delegations(status);
CREATE INDEX idx_delegations_assigned ON cc_delegations(assigned_to);
CREATE INDEX idx_delegations_org ON cc_delegations(org_id);
CREATE INDEX idx_messages_org ON cc_messages(org_id);
CREATE INDEX idx_messages_recipient ON cc_messages(recipient);

-- Enable RLS on all tables
ALTER TABLE cc_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_process_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cc_learnings ENABLE ROW LEVEL SECURITY;

-- RLS policies (each org sees only its own data)
-- Repeat this pattern for each table:
CREATE POLICY "org_isolation" ON cc_decisions
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));
-- ... (apply same pattern to all cc_* tables)
```

---

## Step 3: Configure Supabase Connection

```bash
# Add to /home/node/.openclaw/.env.supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # for server-side operations
```

Create the client:

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
```

---

## Step 4: Deploy API Endpoints

Create two Supabase Edge Functions:

### `cc-read` — Authenticated reads

```typescript
// supabase/functions/cc-read/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { table, filters, limit = 100 } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  let query = supabase.from(table).select('*').limit(limit)
  
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
  }
  
  const { data, error } = await query
  return new Response(JSON.stringify({ data, error }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

### `cc-write` — Authenticated writes

```typescript
// supabase/functions/cc-write/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { table, action, data } = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  let result
  switch (action) {
    case 'insert': result = await supabase.from(table).insert(data); break
    case 'update': result = await supabase.from(table).update(data.values).eq('id', data.id); break
    case 'upsert': result = await supabase.from(table).upsert(data); break
    default: return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 })
  }
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Deploy:
```bash
supabase functions deploy cc-read
supabase functions deploy cc-write
```

---

## Step 5: Enable Realtime

In Supabase Dashboard → Database → Replication:

Enable realtime for:
- `cc_decisions`
- `cc_delegations`
- `cc_messages`
- `cc_priorities`

This powers the live updates in the Command Center — agent status changes, new decisions, and messages appear instantly.

---

## Step 6: Get the CC Code

The Command Center UI is available as a separate starter package:

```bash
# Option A: Clone the starter
git clone https://github.com/EJKIV/forge-command-center
cp -r forge-command-center/src/components/cc/ your-app/src/components/

# Option B: npm package (coming soon)
npm install @forge-ai/command-center
```

---

## Step 7: Wire It Up

```jsx
// App.jsx
import { Shell } from './components/cc/layout/Shell'

function App() {
  return <Shell />
}
```

The Shell component handles:
- Layout (3-zone)
- Routing between views
- Command bar registration
- Keyboard shortcut binding
- Supabase realtime subscriptions

---

## Step 8: Verify

1. **Office Floor** — Should render with mock agents (or live data if delegations exist)
2. **Decision Tree** — Empty canvas if no decisions yet; create one via `record_decision.js`
3. **Task Board** — Empty columns; create tasks via `record_delegation.js`
4. **Command Bar** — Press `⌘K`, type a view name, it should navigate
5. **Realtime** — Open two browser tabs; create a decision in one, see it appear in the other

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Office Floor blank | Check Three.js imports, ensure Canvas has a parent with defined height |
| No live data | Verify Supabase Realtime is enabled for `cc_*` tables |
| Command bar doesn't open | Check `cmdk` import, ensure keyboard listener is registered |
| RLS blocking reads | Set `app.org_id` in Supabase connection config |

---

*Questions? Check [COMMAND_CENTER.md](COMMAND_CENTER.md) for architecture details or [OFFICE_FLOOR.md](OFFICE_FLOOR.md) for 3D scene specifics.*
