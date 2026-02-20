# Database Schema

## cc_decisions

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| decision_id | text | NO | |
| created_at | timestamptz | YES | now() |
| title | text | NO | |
| status | text | YES | 'active' |
| signal | text | YES | |
| thesis | text | YES | |
| decision | text | NO | |
| alternatives | jsonb | YES | |
| authority_level | text | YES | |
| reversibility | text | YES | |
| success_metrics | jsonb | YES | |
| triggered_by | text | YES | |
| category | text | YES | |
| department | text | YES | |
| decision_level | text | YES | 'ceo' |
| parent_decision_id | text | YES | |

## cc_decision_steps

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| decision_id | text | NO | |
| created_at | timestamptz | YES | now() |
| step_type | text | NO | |
| step_order | integer | YES | 0 |
| title | text | YES | |
| content | text | NO | |
| actor | text | YES | |
| metadata | jsonb | YES | '{}' |

## cc_delegations

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| created_at | timestamptz | YES | now() |
| decision_id | text | YES | |
| delegated_to | text | NO | |
| brief | text | YES | |
| status | text | YES | 'pending' |
| result | text | YES | |
| started_at | timestamptz | YES | |
| completed_at | timestamptz | YES | |
| department | text | YES | |
| agent_pose | text | YES | |
| full_prompt | text | YES | |

## cc_priorities

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| rank | integer | NO | |
| title | text | NO | |
| owner | text | YES | |
| phase | text | YES | |
| status | text | YES | 'queued' |
| why_this_rank | text | YES | |
| decision_id | text | YES | |
| updated_at | timestamptz | YES | now() |

## cc_process_runs

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| process_id | text | NO | |
| decision_id | text | YES | |
| delegation_id | text | YES | |
| started_at | timestamptz | YES | now() |
| completed_at | timestamptz | YES | |
| status | text | YES | 'running' |
| actor | text | YES | |
| quality_rating | integer | YES | |
| quality_notes | text | YES | |
| outcome_notes | text | YES | |
| review_requested | boolean | YES | false |

## cc_processes

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | NO | gen_random_uuid() |
| process_id | text | NO | |
| name | text | NO | |
| description | text | YES | |
| file_path | text | YES | |
| category | text | YES | |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() |
