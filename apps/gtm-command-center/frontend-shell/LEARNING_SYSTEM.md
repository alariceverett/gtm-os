# Phase 2: Learning Core (Preference Models)

This document describes the Learning Core system that powers personalized UI adaptation based on user feedback and behavior.

## Overview

The Learning Core consists of four main components:

1. **Preference Engine** - Trains user models from feedback signals
2. **Learning Scheduler** - Runs the learning pipeline every 5 minutes
3. **Suggestion Engine** - Generates smart recommendations based on learned preferences
4. **Personalization Hook** - Applies learned preferences to the UI

## Components

### 1. Preference Engine (`lib/preference-engine.ts`)

Trains user preference models from feedback signals using a weighted scoring algorithm.

**Signal Weights:**
- `explicit_positive`: +1.0 (user thumbs up)
- `explicit_negative`: -1.0 (user thumbs down)
- `implicit_dwell`: +0.5 (spent >10s on section)
- `implicit_skip`: -0.3 (quick dismissal)
- `override_taken`: +0.8 (accepted AI override)

**Key Functions:**
```typescript
import { trainUserModel, getUserModel, calculateFeatureWeights } from '@/lib/preference-engine';

// Train a user's model
const result = await trainUserModel('user-123');

// Get existing model
const model = await getUserModel('user-123');
```

### 2. Learning Scheduler (`lib/learning-scheduler.ts`)

Runs background learning every 5 minutes, batch processing unprocessed feedback.

**Usage:**
```typescript
import { initLearningSystem } from '@/lib/learning-init';

// In your app entry point (layout.tsx)
useEffect(() => {
  initLearningSystem({
    autoStart: true,
    intervalMinutes: 5,
    onLearningComplete: (result) => {
      console.log(`Trained ${result.processed} users`);
    },
    onUIRefreshRecommended: (userIds) => {
      // Notify users that UI has been personalized
    },
  });
}, []);
```

**Manual Control:**
```typescript
import { runLearningNow, getSchedulerStatus } from '@/lib/learning-scheduler';

// Run learning on demand
const result = await runLearningNow();

// Check status
const status = getSchedulerStatus();
```

### 3. Suggestion Engine (`lib/suggestion-engine.ts`)

Generates personalized suggestions based on learned preferences and similar users.

**Suggestion Types:**
- `kpi_priority` - Recommended KPI ordering
- `objective_highlight` - Objectives based on user interest
- `notification_timing` - Optimal notification schedule
- `similar_users` - "Users like you also view..."
- `next_action` - Predicted next step
- `content_recommendation` - Personalized content

**Usage:**
```typescript
import { useSuggestions, getSuggestions } from '@/lib/suggestion-engine';

// Using hook (React)
const { suggestions, isLoading, refresh } = useSuggestions({
  limit: 5,
  context: { currentPage: 'dashboard' },
});

// Direct call
const suggestions = await getSuggestions({
  userId: 'user-123',
  limit: 5,
});
```

### 4. Personalization Hook (`hooks/use-personalization.ts`)

React hook for accessing and applying personalized UI configuration.

**Features:**
- Dashboard card ordering
- Default time range preference
- Notification preferences
- KPI prioritization
- Theme integration

**Usage:**
```typescript
import { usePersonalization } from '@/hooks/use-personalization';

function Dashboard() {
  const { 
    uiConfig, 
    getCardOrder, 
    getDefaultTimeRange,
    updateConfig,
    isLoading 
  } = usePersonalization();

  // Apply personalized card order
  const orderedCards = getCardOrder(['kpi', 'tasks', 'insights']);
  
  // Get preferred time range
  const timeRange = getDefaultTimeRange(); // '7d', '30d', '90d', or 'custom'
  
  // Update preferences
  const handleThemeChange = (theme) => {
    updateConfig({ theme_preference: theme });
  };
}
```

## SmartDashboard Component

Pre-built component demonstrating the full integration:

```typescript
import { SmartDashboard } from '@/components/smart-dashboard';

function MyPage() {
  return (
    <SmartDashboard pageName="strategy">
      {/* Your dashboard content */}
    </SmartDashboard>
  );
}
```

Features:
- Learning status indicator
- Smart suggestions panel
- Training progress bar
- Feedback button integration
- Debug panel (dev mode)

## Database Schema

The learning system uses the following tables:

### feedback_signals
Captures all user interactions for learning.

```sql
- id: UUID PRIMARY KEY
- user_id: TEXT
- signal_type: enum (explicit_positive, explicit_negative, implicit_dwell, etc.)
- context: JSONB { page, section, previous_actions }
- outcome: JSONB
- processed: BOOLEAN
- learning_weight: FLOAT
```

### preference_models
Stores trained preference models per user.

```sql
- user_id: TEXT PRIMARY KEY
- model_version: INTEGER
- feature_weights: JSONB
- ui_config: JSONB
- prediction_accuracy: FLOAT
- training_examples: INTEGER
```

## How It Works

1. **Feedback Collection**: User interactions (clicks, dwell time, explicit feedback) are stored in `feedback_signals`

2. **Learning Pipeline**: Every 5 minutes, the scheduler:
   - Fetches unprocessed signals
   - Calculates feature weights using weighted scoring
   - Updates user preference models
   - Marks signals as processed

3. **Suggestion Generation**: Based on the learned model:
   - Calculate confidence level
   - Generate personalized suggestions
   - Apply collaborative filtering for "users like you" recommendations

4. **UI Adaptation**: Components use `usePersonalization` to:
   - Reorder dashboard cards
   - Set default time ranges
   - Adjust notification preferences
   - Apply theme preferences

## Confidence Levels

The system assigns confidence levels based on data quality:

- **High**: ≥50 examples, ≥60% accuracy
- **Medium**: ≥20 examples OR ≥50% accuracy
- **Low**: <20 examples AND <50% accuracy

Higher confidence suggestions are shown more prominently.

## Privacy Considerations

- All user data is stored locally in Supabase
- No external API calls for learning
- Feature weights are aggregated, no raw interaction history exposed
- Users can clear their preference model via `updateConfig({})`

## Monitoring

Check learning performance:

```typescript
import { getLearningStats, getSchedulerStatus } from '@/lib/learning-scheduler';

const stats = getLearningStats();
console.log(stats);
// {
//   totalRuns: 150,
//   totalSignals: 3240,
//   avgSignalsPerRun: 21.6,
//   successRate: 0.98,
//   avgDuration: 1243
// }
```

## Integration Checklist

- [ ] Add `initLearningSystem()` to your layout.tsx
- [ ] Wrap dashboard pages with `<SmartDashboard>` 
- [ ] Add `<FeedbackButton>` to key sections
- [ ] Use `usePersonalization()` for layout ordering
- [ ] Use `useSuggestions()` for smart recommendations
- [ ] Verify feedback_signals table exists
- [ ] Verify preference_models table exists
- [ ] Monitor learning stats in development

## Files Created

```
frontend-shell/
├── lib/
│   ├── preference-engine.ts      # Core training algorithm
│   ├── learning-scheduler.ts     # Pipeline orchestration
│   ├── suggestion-engine.ts      # Smart recommendations
│   ├── learning-init.ts          # App initialization
│   └── index.ts                  # Module exports
├── hooks/
│   ├── use-personalization.ts    # React personalization hook
│   └── index.ts                  # Hook exports
├── components/
│   └── smart-dashboard.tsx       # Demo integration component
└── LEARNING_SYSTEM.md            # This documentation
```
