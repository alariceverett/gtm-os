# Scripts Guide

All scripts at `/home/node/.openclaw/workspace/org/engine/`. Run with: `node <script> '<json>'`

## record_decision.js

Record or upsert a decision.

**Required:** `decision_id`, `title`, `decision`, `category`, `department`

**Optional:** `status` (default: "active"), `signal`, `thesis`, `alternatives` (array), `authority_level` (default: "ceo_autonomous"), `reversibility` (default: "moderate"), `success_metrics` (array), `triggered_by`, `decision_level` (default: "ceo"), `parent_decision_id`

```bash
node record_decision.js '{"decision_id":"DEC-010","title":"Adopt new CI","decision":"Switch to GitHub Actions","category":"engineering","department":"engineering","thesis":"Faster builds","alternatives":["Keep Jenkins","Try CircleCI"]}'
```

Upserts on `decision_id` — safe to re-run with updated fields.

## record_step.js

Add a reasoning/action step to a decision.

**Required:** `decision_id`, `step_type`, `content`

**Optional:** `step_order` (default: 0), `title`, `actor`, `metadata` (object)

**step_type values:** `thought`, `self_review`, `advisor`, `meeting`, `action`, `brief`, `prompt`, `result`, `learning`, `confirmation`

```bash
node record_step.js '{"decision_id":"DEC-010","step_type":"thought","content":"Evaluated CI options based on cost and speed","title":"CI Evaluation"}'
```

## record_delegation.js

Record a delegation from a decision.

**Required:** `decision_id`, `delegated_to`

**Optional:** `brief`, `status` (default: "pending"), `department`, `agent_pose` (default: "building")

```bash
node record_delegation.js '{"decision_id":"DEC-010","delegated_to":"Engineering Lead","brief":"Migrate CI to GitHub Actions","status":"running","department":"engineering"}'
```

If `status` is "running", `started_at` is set automatically.

## update_delegation.js

Update delegation status/result.

**Required:** `decision_id`, `delegated_to`

**Optional:** `status`, `result`, `agent_pose`

```bash
node update_delegation.js '{"decision_id":"DEC-010","delegated_to":"Engineering Lead","status":"completed","result":"Migration complete, builds 3x faster"}'
```

Timestamps: `started_at` set when status="running", `completed_at` set when status="completed"|"failed".

## sync_priorities.js

Replace the entire priority queue.

**Input:** JSON array. Each item: `rank` (required), `title` (required), `owner`, `phase`, `status` (default: "queued"), `why_this_rank`, `decision_id`

```bash
node sync_priorities.js '[{"rank":1,"title":"Ship MVP","owner":"CTO","phase":"build","status":"active","why_this_rank":"Revenue blocker"},{"rank":2,"title":"Hire designer","owner":"CEO"}]'
```

**Warning:** Deletes all existing priorities and replaces with provided list.

## register_process.js

Register a process in the registry.

**Required:** `process_id`, `name`

**Optional:** `description`, `file_path`, `category`

```bash
node register_process.js '{"process_id":"weekly-review","name":"Weekly Review","description":"Weekly ops review process","category":"operations"}'
```

Upserts on `process_id`.

## start_process_run.js

Start a process run. Prints the run UUID.

**Required:** `process_id`, `actor`

**Optional:** `decision_id`, `delegation_id`

```bash
node start_process_run.js '{"process_id":"weekly-review","actor":"CEO Agent"}'
# Output: ✅ Process run started: <uuid>
# <uuid>
```

Save the returned UUID to complete the run later.

## complete_process_run.js

Complete a process run.

**Required:** `run_id` (UUID from start), `status` ("completed"|"failed"|"skipped")

**Optional:** `quality_rating` (integer), `quality_notes`, `outcome_notes`, `review_requested` (boolean)

```bash
node complete_process_run.js '{"run_id":"abc-123","status":"completed","quality_rating":4,"outcome_notes":"All items addressed"}'
```

## process_report.js

Print a process tracking report (no arguments).

```bash
node process_report.js
```

Shows: runs per process, average quality ratings, top 5 most-used, unused processes, and runs with review requested.
