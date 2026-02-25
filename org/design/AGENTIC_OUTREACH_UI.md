# Agentic Outreach UI Design

## Philosophy: Natural Language First, Filters Last

Instead of endless forms and filters, users speak to the system. The AI does the research, recommends targets, and designs sequences. Visualizations show confidence, progress, and results—not configuration forms.

## Core Experience Flow

### 1. Command Bar Primary (⌘K)
Natural language command interface, always available.

**User says:**
> "Find me CMOs at fintechs Series B or later in NYC with recent hiring for growth"

**System does:**
- Parses intent (ICP: CMO, fintech, Series B+, NYC, hiring signal)
- Creates research job via Apollo MCP
- Shows live progress card
- Returns enriched prospects with quality scores
- Suggests campaign with 3 variants

**Visual:** Card-based results, not table filters

### 2. Smart Suggestions
System proactively suggests based on context.

**Example:**
- User viewing high-value prospect → Suggests "Create personalized campaign"
- Low reply rate on sequence → Suggests "A/B test subject line variants"
- New funding announcement → Suggests "Add to priority list"

### 3. Conversation Thread (Right Panel)
Every action is part of a thread. Can refer back, modify, branch.

```
User: "Research SaaS companies doing layoffs"
[Research job started... progress: 47 prospects found]

User: "Focus on engineering leaders at those companies"
[Refining search... now 23 prospects: VPs/CTOs]

User: "Create a 'we're hiring' campaign"
[Comparing to previous campaigns... suggesting 3 variants]
[System: "Your 'hiring' campaigns have 34% reply rate vs 12% generic. Recommend emphasizing team growth?"]
```

## UI Components

### Main Dashboard

```
┌──────────────────┬─────────────────────────────┬──────────┐
│                  │                             │          │
│  Command Bar     │    Active Research Jobs     │ Thread   │
│  (fixed top)     │    (cards with progress)    │ History  │
│                  │                             │          │
│                  ├─────────────────────────────┤          │
│                  │    Suggestions Carousel     │          │
│                  │    (swipable, context-aware)│          │
│                  │                             │          │
│                  ├─────────────────────────────┤          │
│                  │    Prospects Stream         │          │
│                  │    (infinite scroll cards)  │          │
│                  │                             │          │
│                  ├─────────────────────────────┤          │
│                  │    Campaign Performance     │          │
│                  │    (sparklines, variants)   │          │
│                  │                             │          │
└──────────────────┴─────────────────────────────┴──────────┘
```

### Prospect Card

```
┌─────────────────────────────────────────────┐
│  🟢 A+ Score                               │
│                                             │
│  Jane Smith                                 │
│  VP Marketing @ Acme                        │
│  NYC • Series B • 50-200 emp               │
│                                             │
│  Signals: Hiring 3 marketers | New CTO    │
│  Last Contact: 2 days ago (email opened)    │
│                                             │
│  [🎯 Start Outreach] [📊 View Signals]     │
└─────────────────────────────────────────────┘
```

### Sequence Visualizer

```
┌─────────────────────────────────────────────┐
│  Campaign: "Team Growth"                    │
│                                             │
│  Day 1   ━━━━━━━━━━━━━━━━━━━━ A/B Test    │
│          ✉️ "We noticed you're hiring..." │
│          📊 A: "Join our growth team"      │
│          📊 B: "Scale faster together"     │
│          A winning: 18% vs 11% (23% margin) │
│                                             │
│  Day 3   ━━━━━━━━━━━┳━━━ LinkedIn connect  │
│                     👤 Auto-sent           │
│                     67% accepted           │
│                     ┗━━━ Email fallback    │
│                                             │
│  Day 7   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│          📞 "Worth a 15-min call?"         │
│          [Recommended: morning EST]         │
└─────────────────────────────────────────────┘
```

## MCP Integration

### Apollo MCP Server

```typescript
// Using Anthropic's MCP with Apollo
interface ApolloMCP {
  // Research prospects by natural language
  searchProspects(query: string): Promise<Prospect[]>;
  
  // Enrich single prospect
  enrichProspect(id: string): Promise<EnrichedProspect>;
  
  // Verify email/phone
  verifyContact(id: string): Promise<VerificationResult>;
}

// Command parsing
interface CommandIntent {
  action: 'research' | 'enrich' | 'campaign' | 'sequence';
  icp?: {
    title?: string[];
    companyIndustry?: string[];
    companySize?: string;
    location?: string[];
    signals?: string[];
  };
  campaign?: {
    name?: string;
    variantCount?: number;
  };
}
```

## Technical Stack

- **MCP Client**: `@anthropic/mcp` with Apollo server
- **Command Parsing**: GPT-4 for NL → structured intent
- **Real-time**: Supabase Realtime for job progress
- **Visualization**: Framer Motion for smooth transitions
- **Typography**: Inter for command, JetBrains Mono for code/data

## Key Interactions

1. **Start research:** Type or speak → Parse → Show progress card → Stream results
2. **Review prospect:** Tap card → Expanded view with signals → One-tap outreach
3. **Create campaign:** Select prospects → "Suggest campaign" → Review suggestions → Launch
4. **Monitor performance:** Live sparklines → Variants shown side-by-side → Auto-optimization suggestions
5. **Iterate:** "Double down on variant A" → System adjusts spend/distribution

## Anti-Patterns Avoided

❌ Advanced search with 12 filters
✅ Natural language: "Find companies like Stripe but smaller"

❌ Manual sequence builder with drag-and-drop
✅ "Create a 3-touch sequence for engineering leaders"

❌ Comparing 8 metrics in tables
✅ "Why is this campaign working better?" → AI explains

❌ Manual A/B test configuration
✅ System suggests variants based on past performance
