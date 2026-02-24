# Delegation Enforcement (Local Implementation)

## Rule
If there are 2+ active workstreams, default to delegation.

## Pre-execution Gate
Before doing non-trivial execution directly, require one of:
1. Delegated to a sub-agent/session, or
2. A one-line `why_not_delegated` justification.

## Auto-Spawn Triggers
Spawn sub-agents when any of these are true:
- Parallelizable streams exist
- Estimated effort > 15 minutes
- Task includes research + implementation + reporting

## Drift Check
At each heartbeat/work review, check:
- active streams count
- delegated streams count
- direct-execution-only streams count

If direct execution dominates, re-balance by spawning workers.

## Current Active Streams (delegated)
- restaurant-app-build
- group-chat-behavior-tuning
- forge-sync-and-integration
