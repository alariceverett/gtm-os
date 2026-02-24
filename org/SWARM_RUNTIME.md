# SWARM_RUNTIME.md

Permanent role-based swarm runtime.

## Roles

Execution order per lane:

1. planner
2. builder
3. integrator
4. qa
5. design
6. release

## Guarantees

- **Role-based coordination:** each lane has exactly one current role.
- **Handoff schema enforcement:** lane only advances when handoff packet validates.
- **Cap-aware scheduling:** child scheduling limited by `active_child_cap` (hard-clamped to max 5).
- **Ops status output:** runtime writes lane status to:
  - `ops/swarm_lanes.json`
  - `ops/swarm_lanes.md`

## Files

- Runtime: `scripts/swarm_runtime.py`
- Config: `org/swarm_runtime.config.json`
- State: `memory/swarm_runtime/state.json`
- Lock: `memory/swarm_runtime/runtime.lock`
- Ops status: `ops/swarm_lanes.json`, `ops/swarm_lanes.md`

## Commands

Initialize lanes from `org/WORK_QUEUE.md`:

```bash
python3 scripts/swarm_runtime.py --init
```

Run one scheduling tick:

```bash
python3 scripts/swarm_runtime.py --tick
```

Run forever (permanent runtime loop):

```bash
python3 scripts/swarm_runtime.py
```

Write/read `/ops` status:

```bash
python3 scripts/swarm_runtime.py --status
```

Submit and validate handoff packet:

```bash
python3 scripts/swarm_runtime.py --submit-handoff <lane_id> <packet.json>
```

If validation fails, lane moves to `handoff_rejected` with `handoff_errors` in state.
