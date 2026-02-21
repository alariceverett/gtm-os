# Skill Performance Loop (Always-On)

## Objective
Continuously identify and build/adopt skills that increase agent throughput, quality, and reliability.

## Cadence
- Daily: quick scan of failures/rework/repeated asks
- Weekly: structured skill-gap review and top-3 prioritization

## Inputs
- Repeated blockers
- Repeated manual steps
- High token-cost tasks
- Failed/slow subagent runs
- User repeated requests for the same capabilities

## Process
1. Capture candidate skill gaps with evidence (task, impact, frequency).
2. Score each candidate on:
   - Throughput impact
   - Quality/safety impact
   - Reuse across projects
   - Implementation effort
3. Select top 3 and queue them.
4. Build/adopt skill and measure before/after.
5. Upstream structural gaps to Forge.

## Required Artifacts
- `org/skill-gaps.jsonl` (append-only observations)
- Weekly summary in queue/status update
- Forge issue/updates for platform-level gaps

## Success Metrics
- Lower task cycle time
- Fewer repeated blockers
- Lower token spend per completed milestone
- Higher autonomous completion rate
