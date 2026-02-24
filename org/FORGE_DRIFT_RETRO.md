# Forge Drift Retrospective (Field)

## What drifted
1. Delegation principle was documented but not enforced by runtime checks.
2. Surface/channel auth instability (webchat vs telegram) consumed execution bandwidth.
3. Scope switching (GTM app vs restaurant app) briefly blurred queue discipline.
4. Security response style initially blocked data leaks but still over-explained boundaries.

## Why it happened
- No hard delegate-by-default gate in runtime behavior.
- Pairing/device-scope friction on gateway actions created repeated context resets.
- Parallel setup + build + channel onboarding increased cognitive load.

## What fixed it
- Added delegation enforcement rules and spawned parallel workers once unblocked.
- Tightened group-chat policy and hard-stop behavior for suspicious actors.
- Added explicit Forge feedback loop cadence/triggers.
- Re-scoped work queue to restaurant app priorities.

## Product improvements recommended for Forge
1. Enforced delegation gate with “why_not_delegated” requirement.
2. Built-in drift metric (% delegated vs direct execution).
3. Stronger onboarding for multi-surface auth/pairing consistency.
4. Security-mode presets for group-chat adversarial behavior.
5. First-class assisted bootstrap defaults for non-technical operators.
