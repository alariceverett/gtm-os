---
name: decision-engine
description: Record decisions, delegations, steps, process runs, and priorities using the org engine scripts. Use when tracking organizational decisions and delegation chains.
---


# Decision Engine

The decision engine tracks all organizational decisions, their reasoning steps, delegations to leads/agents, and process execution. All scripts live in `/home/node/.openclaw/workspace/org/engine/` and accept JSON arguments.

## Quick Reference

All commands: `node /home/node/.openclaw/workspace/org/engine/<script> '<json>'`

| Script | Required Fields | Example |
|--------|----------------|---------|
| `record_decision.js` | decision_id, title, decision, category, department | `'{"decision_id":"DEC-010","title":"Launch X","decision":"Ship it","category":"product","department":"product"}'` |
| `record_step.js` | decision_id, step_type, content | `'{"decision_id":"DEC-010","step_type":"thought","content":"Evaluated options..."}'` |
| `record_delegation.js` | decision_id, delegated_to | `'{"decision_id":"DEC-010","delegated_to":"Growth Lead","brief":"Execute launch plan"}'` |
| `update_delegation.js` | decision_id, delegated_to | `'{"decision_id":"DEC-010","delegated_to":"Growth Lead","status":"completed","result":"Done"}'` |
| `sync_priorities.js` | JSON array of items | `'[{"rank":1,"title":"Ship MVP","owner":"CTO","phase":"build","status":"active"}]'` |
| `register_process.js` | process_id, name | `'{"process_id":"product-pipeline","name":"Product Pipeline"}'` |
| `start_process_run.js` | process_id, actor | `'{"process_id":"product-pipeline","actor":"CEO Agent"}'` |
| `complete_process_run.js` | run_id, status | `'{"run_id":"<uuid>","status":"completed","quality_rating":4}'` |
| `process_report.js` | (none) | No arguments needed |

## Step Types for record_step.js

`thought`, `self_review`, `advisor`, `meeting`, `action`, `brief`, `prompt`, `result`, `learning`, `confirmation`

## Delegation Statuses

`pending` → `running` → `completed` | `failed`

## Details

- Full script parameters and examples: see `references/scripts-guide.md`
- Database schemas: see `references/schema.md`
