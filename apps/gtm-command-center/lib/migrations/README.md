# Feedback & Learning Infrastructure (GATE 3)

## Overview

Complete feedback pipeline for the GTM OS to learn from user behavior.

## Database Schema

### Tables

#### feedback_signals
Captures all user interactions and explicit feedback.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Unique identifier |
| user_id | TEXT | User identifier |
| timestamp | TIMESTAMPTZ | When signal was created |
| signal_type | ENUM | explicit_positive, explicit_negative, implicit_dwell, implicit_skip, command_issued, override_taken, question_asked |
| context | JSONB | {page, section, previous_actions, ui_state} |
| content | TEXT | Voice/text transcript or null |
| outcome | JSONB | What happened after feedback |
| processed | BOOLEAN | Whether processed by learning |
| learning_weight | FLOAT | Weight for learning algorithms |

#### preference_models
Per-user learned preference models for personalization.

| Column | Type | Description |
|--------|------|-------------|
| user_id | TEXT PK | User identifier |
| model_version | INT | Version of preference model |
| feature_weights | JSONB | What the user cares about |
| ui_config | JSONB | Personalized layout |
| prediction_accuracy | FLOAT | Current model accuracy |
| training_examples | INT | Number of training examples |
| last_updated | TIMESTAMPTZ | Last update time |

#### outcome_ledger
Tracks action-outcome pairs for reinforcement learning.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Unique identifier |
| action_taken | JSONB | Action performed |
| outcome_value | FLOAT | -1 to 1 score |
| outcome_type | ENUM | conversion, dismissal, escalation, completion, abandonment, success, failure |
| feedback_id | FK | Related feedback signal |
| learning_applied | BOOLEAN | Whether learning was applied |

#### dwell_time_sessions
Tracks time spent on pages/sections.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Unique identifier |
| user_id | TEXT | User identifier |
| page | TEXT | Page path |
| section | TEXT | Section identifier |
| start_time | TIMESTAMPTZ | When session started |
| end_time | TIMESTAMPTZ | When session ended |
| duration_seconds | INT | Total duration |
| scroll_depth | FLOAT | 0-1 scroll depth |
| metadata | JSONB | Additional metadata |

#### interaction_batches
Batched interaction data for efficient processing.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Unique identifier |
| user_id | TEXT | User identifier |
| batch_data | JSONB | Array of interactions |
| session_id | TEXT | Session identifier |
| processed | BOOLEAN | Whether processed |

#### feedback_analytics (Materialized View)
Pre-aggregated feedback metrics for fast querying.

## API Endpoints

### POST /api/feedback
Store feedback signal.

**Request Body:**
```json
{
  "signal_type": "explicit_positive",
  "user_id": "optional-user-id",
  "context": {
    "page": "/",
    "section": "hero",
    "previous_actions": ["scroll", "view"],
    "ui_state": { "theme": "dark" }
  },
  "content": "Great feature!",
  "outcome": { "helpful": true },
  "learning_weight": 1.0
}
```

**Response:**
```json
{ "id": "uuid", "status": "stored", "marker": "feedback-signal-v1" }
```

### POST /api/feedback/batch
Store batched interactions.

**Request Body:**
```json
{
  "user_id": "user-id",
  "session_id": "session-id",
  "batch_data": {
    "events": [...],
    "page_url": "/page",
    "start_time": 1234567890,
    "end_time": 1234567900
  }
}
```

### GET /api/users/:id/preferences
Get preference model.

**Response:**
```json
{
  "feature_weights": { "dark_mode_preference": 0.8 },
  "ui_config": { "theme": "dark" },
  "prediction_accuracy": 0.85
}
```

### POST /api/users/:id/preferences
Update preferences.

**Request Body (Delta):**
```json
{ "delta": { "dark_mode_preference": 0.9 } }
```

**Request Body (Full Model):**
```json
{
  "feature_weights": { ... },
  "ui_config": { ... }
}
```

### GET /api/feedback/analytics
Aggregate feedback for learning.

## Frontend Components

### FeedbackButton
Subtle feedback button (thumbs up/down or smiley).

```tsx
import { FeedbackButton } from '@/components/feedback-button';

<FeedbackButton
  context={{
    page: '/',
    section: 'hero'
  }}
  variant="thumbs" // or "smiley" or "minimal"
  onFeedbackSubmit={async (feedback) => {
    // Custom handler
  }}
/>
```

### VoiceFeedback
Floating mic button for voice feedback.

```tsx
import { VoiceFeedback } from '@/components/voice-feedback';

<VoiceFeedback
  context={{ page: '/', section: 'global' }}
  onSubmit={async ({ content, duration }) => {
    // Handle submission
  }}
/>
```

### useDwellTime Hook
Track time spent on sections.

```tsx
import { useDwellTime, DwellTimeTracker } from '@/hooks/use-dwell-time';

// Hook approach
const { ref } = useDwellTime({
  sectionId: 'hero',
  page: '/',
  threshold: 10000, // 10 seconds
  onDwell: (event) => console.log('Dwell:', event)
});

// Component approach
<DwellTimeTracker
  sectionId="hero"
  threshold={10000}
>
  {<YourContent />}
</DwellTimeTracker>
```

### InteractionLogger
Captures clicks, hovers, scrolls automatically.

```tsx
import { useInteractionLogger, createInteractionLogger } from '@/lib/interaction-logger';

// Auto-initialize
import '@/lib/interaction-logger'; // Initializes automatically

// Manual control
const { log, pause, resume, flush } = useInteractionLogger();

log('click', {
  element: document.getElementById('button')
});
```

## Privacy

- Sensitive inputs (password, email) are never logged
- Private sections marked with `data-private` are excluded
- User data is anonymized with generated user IDs
- No PII is captured or stored

## Learning Integration

### Theme Learning
The theme provider automatically learns user preferences:

1. Tracks theme toggles (dark/light)
2. Calculates preference confidence (80%+ threshold)
3. Syncs learned preferences to backend
4. Sends feedback signals for reinforcement learning

```tsx
const { themePreferenceLearned, toggleTheme } = useTheme();

if (themePreferenceLearned) {
  console.log('We learned the user\'s theme preference!');
}
```

### Feedback Context
Page-level context for tracking:

```tsx
import { useFeedbackContext } from '@/app/page';

const context = useFeedbackContext();
context.logInteraction('custom_action', { detail: 'data' });
```

## Tests

Run tests:
```bash
npm test -- __tests__/feedback
```

Test coverage:
- ✅ Feedback signal creation
- ✅ Preference model update
- ✅ API endpoints

## Migration

Apply migration:
```sql
-- Run the migration file
psql -U user -d db -f lib/migrations/003_feedback_system.sql
```

Or via Supabase:
```sql
-- In Supabase SQL Editor
-- Copy contents of 003_feedback_system.sql
```

## Success Criteria

✅ User can click "feedback" on any section and add text
✅ System tracks dwell time on sections
✅ API stores feedback in database
✅ Preference model can be fetched/updated
✅ Privacy is respected (no sensitive data logged)
