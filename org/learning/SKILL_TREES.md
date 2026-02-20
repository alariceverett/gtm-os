# Skill Trees — Agent Role Development

> Each role has a set of skills. Each skill has four levels. We track where we are and deliberately invest in moving up.

---

## How to Read This Document

Each skill includes:
- **What it means** — the actual capability
- **Level definitions** — what each level looks like in practice
- **How to level up** — specific investments that develop the skill
- **Current level** — where we assess ourselves today (updated during weekly reviews)

Levels:
- **L1 Novice:** Can produce output with heavy guidance. Needs detailed examples and step-by-step instructions.
- **L2 Competent:** Works independently to acceptable standard. Follows playbooks. Occasional revision.
- **L3 Proficient:** Consistently good. Adapts to context. Rarely revised. Notices patterns.
- **L4 Expert:** Exceptional. Creates new approaches. Writes playbooks for others.

---

## Dashboard Builder

### 1. Data Visualization
*Choosing the right chart, using color meaningfully, balancing information density with clarity.*

| Level | Looks Like |
|-------|-----------|
| L1 | Uses bar charts for everything. Default colors. Too much or too little data on screen. |
| L2 | Selects appropriate chart types. Consistent color palette. Reasonable information density. |
| L3 | Chart choices amplify the insight (e.g., slope charts for comparison, sparklines for trends). Color encodes meaning. Every element earns its space. |
| L4 | Invents novel visualizations when standard ones don't serve the data. Creates visualization guidelines others follow. |

**Level up via:** Curated examples of excellent data viz, chart selection decision tree in playbook, color palette standards in design system.

**Current level:** L2 (as of 2026-02-18, based on PROP-001)

**Improvement:** 2026-02-18 — Prompt updated. Communication-First Approach moved to top. Expected to improve storytelling by forcing narrative-first thinking. Monitoring for L2→L3 progress.

### 2. Storytelling
*Building a narrative arc. Making data tell a story. Answering "so what?" before the viewer has to ask.*

| Level | Looks Like |
|-------|-----------|
| L1 | Dashboard shows data but doesn't explain it. Viewer must interpret everything. |
| L2 | Includes titles that describe what each section shows. Some context provided. |
| L3 | Each section has a narrative: what happened, why it matters, what to do. Insights are highlighted. Dashboard has a clear reading order. |
| L4 | Dashboard tells a compelling story that drives action. Executive summary captures the full narrative in 3 sentences. Non-expert viewers understand immediately. |

**Level up via:** Annotation examples, "insight hierarchy" framework, before/after comparisons of data-only vs narrative dashboards.

**Current level:** L1 → L2 (PENDING VALIDATION) — Training deployed 2026-02-18, awaiting PROP-001 rebuild

**Improvement History:**
- 2026-02-17: PROP-001 identified as L1 ("charts without story"). Communication rubric 4/10 — narrative fundamentally missing.
- 2026-02-18: Training deployed. Studied StorytellingWithData (3 articles on narrative design, visual hierarchy, annotation). 8 techniques added to AGENT_PROMPT.md: Spell Out Takeaway, Articulate Action, Chunk Info, Annotate, Simplify Viz, Progressive Disclosure, Visual Hierarchy, Table vs Graph Decision Tree.
- 2026-02-18: Added "Communication-First Approach" to top of workflow. Agent now explicitly checks: "What's the ONE thing this dashboard must communicate?" BEFORE designing.
- **2026-02-19 Status:** Training validates at thinking-framework level (narrative-first approach adopted in briefs). PROP-001 rebuild scheduled as validation milestone. Target: Communication score 8+/10 (vs current 4/10). Execution expected by Feb 21. If rebuild achieves 8+, L1→L2 confirmed. If rebuild stays below 7, framework requires revision.

### 3. Visual Design
*Typography, spacing, alignment, professional polish. Does it look like a $5K deliverable or a homework assignment?*

| Level | Looks Like |
|-------|-----------|
| L1 | Functional but unpolished. Inconsistent spacing. Default fonts. Looks "built by a developer." |
| L2 | Clean and consistent. Follows design system. Professional enough for client delivery. |
| L3 | Polished and intentional. White space used effectively. Typography hierarchy guides the eye. Feels premium. |
| L4 | Beautiful. Could appear in a design portfolio. Every pixel is intentional. Sets the standard for the org. |

**Level up via:** Design system enforcement, reference examples from Dribbble/Behance, spacing/typography checklists.

**Current level:** L2 (design system exists but wasn't fully applied in PROP-001)

### 4. Interactivity
*Filters, drill-downs, responsive behavior. Does the dashboard invite exploration?*

| Level | Looks Like |
|-------|-----------|
| L1 | Static display. No filters. Fixed view. |
| L2 | Basic filters work. Some drill-down capability. Responsive on common screen sizes. |
| L3 | Thoughtful filter design (shows relevant options, hides noise). Smooth transitions. Works beautifully on mobile. |
| L4 | Interaction model anticipates user questions. Progressive disclosure reveals detail on demand. Feels like a product, not a report. |

**Level up via:** UX pattern library, user flow diagrams, testing on multiple devices.

**Current level:** L2 (PROP-001 had functional interactivity)

### 5. Client Empathy
*Understanding what the CLIENT needs to see, not what we want to show. Solving their problem, not showcasing our skills.*

| Level | Looks Like |
|-------|-----------|
| L1 | Shows all available data. Organized by data source, not by user need. |
| L2 | Organized by business question. Shows relevant metrics. Filters for their use case. |
| L3 | Anticipates what they'll want to know next. Highlights exceptions and anomalies. Saves them time. |
| L4 | Dashboard changes how they think about their business. Surfaces insights they didn't know to ask for. Becomes indispensable. |

**Level up via:** Client interview frameworks, "jobs to be done" analysis, studying which dashboard sections clients actually use.

**Current level:** L1 (PROP-001 showed what we could build, not what the client needed to see) — **positive signal emerging**

**Evidence & Improvement:**
- 2026-02-17: PROP-001 assessment: "Showed what we could build, not what client needed." L1.
- 2026-02-18: Freelancer exercise (kuliner/food takeaway brief) — Agent identified the client's real question: "How confident should I be this works?" — not just "what should my plan include?" This reframe (client's underlying fear vs stated requirement) is L2 thinking. Exercise score: 7.75 (moved from 6.25).
- **Interpretation:** One exercise doesn't confirm L2 consistency, but shows the skill is responsive to training. Next proposal will validate permanence.
- **Action:** Prompt updated with pre-check guidance: "What does the client really need to validate before committing?" This forces empathy-first thinking before solution design.

---

## Proposal Writer

### 1. Persuasion
*Opening hooks, pain-point framing, urgency creation. Making the client feel "this person gets it."*

| Level | Looks Like |
|-------|-----------|
| L1 | States capabilities. Lists services. Reads like a resume. |
| L2 | Identifies client's problem. Positions our solution against it. Clear value proposition. |
| L3 | Opens with a hook that shows deep understanding. Frames pain before solution. Creates natural urgency without being pushy. |
| L4 | Client feels understood on first paragraph. Proposal reframes their problem in a way that makes our solution inevitable. They share it internally as "this is exactly what we need." |

**Level up via:** Study winning proposals, A/B test opening lines, collect client feedback on what resonated.

**Current level:** L2 (STABLE) — **Validated 2026-02-19 across 3 consecutive proposals**

**Evidence & Improvement:**
- 2026-02-17: PROP-001 assessed L2. Clear value prop, good structure, but opening was explanation-first (not emotion-first).
- 2026-02-18: Pre-Research Checklist deployed (extract emotional triggers, exact language, red flags). SPSA test: Opened with "investor-readiness confidence" (reframing problem, not stating capabilities). Communication 8/10.
- **2026-02-19 Validation:** Proposal Drafter voice shows 3 consecutive proposals all ≥7/10 on all rubrics. Emotional trigger extraction evident in all three: men's wear (scaling concerns), pitch deck (investor confidence), market research (market validation). Framework adoption consistent, not one-off success.
- **Status:** L2 validated as stable. L3 potential requires moving beyond emotional triggers into category creation (client can't compare us to alternatives). Monitor next 5 proposals; if opening hooks start reframing entire problem category, escalate to L3.

### 2. Specificity
*Concrete examples, numbers, proof points. "We'll increase conversion by 23%" vs "we'll improve your metrics."*

| Level | Looks Like |
|-------|-----------|
| L1 | Vague promises. "We'll build a great dashboard." No numbers. |
| L2 | Includes some specifics. Mentions timelines and deliverables. |
| L3 | Every claim backed by a number, example, or proof point. Deliverables are concrete and measurable. |
| L4 | Specificity is strategic — numbers are chosen to be both credible and compelling. Includes social proof, case studies, specific methodologies. |

**Level up via:** Mandate minimum 5 specific numbers per proposal, build proof point library, study competitor proposals.

**Current level:** L2

### 3. Structure
*Scannable, progressive disclosure, executive summary. Respects the reader's time.*

| Level | Looks Like |
|-------|-----------|
| L1 | Wall of text. No clear sections. Reader has to work to find information. |
| L2 | Clear sections with headers. Logical flow. Executive summary present. |
| L3 | Scannable in 30 seconds (headers tell the story). Deep detail available for those who want it. Reader can engage at their preferred depth. |
| L4 | Structure itself is persuasive — guides the reader through a decision journey. Each section builds on the last. Impossible to stop reading partway. |

**Level up via:** Proposal templates with required sections, study how top consulting firms structure proposals.

**Current level:** L2

### 4. Differentiation
*Why us, not just what we do. What makes this proposal impossible to compare with cheaper alternatives.*

| Level | Looks Like |
|-------|-----------|
| L1 | Lists what we do. Could be written by any competitor. |
| L2 | Mentions unique aspects. "We use AI" or "fast turnaround." |
| L3 | Clear, specific differentiators tied to client value. Shows WHY our approach is better, not just that it's different. |
| L4 | Creates a new category. Client can't compare us to alternatives because we've reframed what they're buying. |

**Level up via:** Competitor analysis, unique value prop development, "90% solution" demo approach.

**Current level:** L3 (leading with a working demo IS differentiation — we just need to execute it better)

### 5. Client Research
*Demonstrating deep understanding of THEIR business, not generic industry knowledge.*

| Level | Looks Like |
|-------|-----------|
| L1 | Generic industry references. Could apply to any client in the sector. |
| L2 | References client's specific company, products, or stated needs. |
| L3 | Shows understanding of their competitive position, recent changes, unstated needs. References their own content back to them. |
| L4 | Understands the client's business better than they expected. Identifies opportunities they hadn't considered. Feels like talking to an insider. |

**Level up via:** Research checklist (company, competitors, recent news, LinkedIn, reviews), reference-back techniques.

**Current level:** L2

---

## Analyst

### 1. Insight Extraction
*Finding the "so what?" in data. Separating signal from noise.*

| Level | Looks Like |
|-------|-----------|
| L1 | Describes what the data shows. "Revenue went up 12%." No interpretation. |
| L2 | Identifies trends and anomalies. "Revenue is up 12%, driven primarily by Q4 holiday sales." |
| L3 | Finds non-obvious insights. Connects multiple data points. "Revenue is up 12% but customer acquisition cost rose 34%, meaning growth is becoming less efficient." |
| L4 | Finds insights that change strategy. "Despite 12% revenue growth, per-customer revenue is declining while acquisition cost rises — current growth model has 8 months before it becomes unprofitable." |

**Level up via:** 7-technique framework (So What Rule, Context Stacking, Anomaly Hunt, Ratio Lens, Causation Testing, Second-Order Effects, Hypothesis Testing). See `org/learning/lessons/INSIGHT_EXTRACTION_MASTERY.md`.

**Current level:** L1 (UNTESTED) — **Training deployed 2026-02-18, field validation pending**

**Training Deployed (2026-02-18):**
- Created INSIGHT_EXTRACTION_MASTERY.md with 7 core techniques
- Updated opportunity-analyst/AGENT_PROMPT.md with framework + 7-point quality gate
- Basis: McKinsey insight methodology, Edward Tufte (visual/ratio thinking), Nate Silver (signal/noise)

**2026-02-19 Status:**
- Framework ready, zero field validation yet
- First analyst task assignment pending (required by Feb 20)
- Opportunities available (15 scanned) but not analyzed
- Success criteria: 80%+ pass rate on "So What Rule" + "Context Stacking" checks
- Validation milestone: First 3-5 opportunity assessments will determine L1→L2 readiness

### 2. Recommendation Quality
*Specific, actionable, prioritized. Not "consider improving marketing" but "reallocate $12K/mo from paid search to email nurture sequences."*

| Level | Looks Like |
|-------|-----------|
| L1 | Generic suggestions. "Improve customer retention." No specifics. |
| L2 | Actionable recommendations with some specificity. "Launch a loyalty program targeting top 20% customers." |
| L3 | Prioritized, specific, with expected impact. "Priority 1: Reduce checkout abandonment (est. $47K/mo recovery) by adding guest checkout option." |
| L4 | Recommendations include implementation roadmap, resource requirements, risk assessment, and measurement plan. Client can act on them immediately. |

**Level up via:** Recommendation templates, impact estimation frameworks, implementation feasibility checklists.

**Current level:** L1 (untested)

### 3. Communication
*Making complex simple. Appropriate detail for the audience.*

| Level | Looks Like |
|-------|-----------|
| L1 | Uses jargon. Assumes technical knowledge. Buries conclusions in methodology. |
| L2 | Clear language. Conclusions up front. Technical details available but not dominant. |
| L3 | Adapts communication to audience. Executive gets 3 bullets; analyst gets full methodology. Visual aids clarify complex points. |
| L4 | Complex analysis feels simple. Reader thinks "of course, that's obvious" — which means the communication worked perfectly. |

**Level up via:** Audience-level templates, "explain it to a 12-year-old" exercises, progressive disclosure frameworks.

**Current level:** L1 (untested)

### 4. Methodology
*Sound analytical approaches. Bias awareness. Statistical validity.*

| Level | Looks Like |
|-------|-----------|
| L1 | Basic analysis. May confuse correlation with causation. No methodology discussion. |
| L2 | Uses appropriate methods. Acknowledges limitations. Basic statistical validity. |
| L3 | Chooses optimal methodology for the question. Proactively addresses biases. Confidence intervals included. |
| L4 | Methodology is itself a differentiator. Novel analytical approaches. Transparent about assumptions. Peer-review quality. |

**Level up via:** Analytical framework library, bias checklist, methodology decision tree.

**Current level:** L1 (untested)

### 5. Business Context
*Connecting analysis to business outcomes. Making numbers matter.*

| Level | Looks Like |
|-------|-----------|
| L1 | Analysis exists in a vacuum. Numbers without business meaning. |
| L2 | Connects findings to business metrics. "This trend affects revenue." |
| L3 | Translates every finding into business impact with dollar estimates. Understands industry context. |
| L4 | Analysis directly informs business strategy. Client uses it in board meetings. Changes how they allocate resources. |

**Level up via:** Business model frameworks, industry benchmarking data, revenue impact estimation templates.

**Current level:** L1 (untested)

---

## Quality Critic

### 1. Calibration
*Consistent scoring. Understanding what each score means. A 7 from this week matches a 7 from last week.*

| Level | Looks Like |
|-------|-----------|
| L1 | Scores are inconsistent. Generous or harsh without pattern. No reference points. |
| L2 | Consistent within a session. Uses rubric correctly. May drift over time. |
| L3 | Calibrated against benchmarks. Scores are predictive of client satisfaction. Consistent across weeks. |
| L4 | Gold-standard calibration. Other agents' scores can be validated against this critic's assessment. Maintains benchmark library. |

**Level up via:** Benchmark scoring exercises, inter-rater reliability checks, calibration sessions with reference work.

**Current level:** L1 (quality critic system being built)

### 2. Constructive Feedback
*Actionable, specific, growth-oriented. Not "this is bad" but "the executive summary buries the lead — move the ROI figure to sentence one."*

| Level | Looks Like |
|-------|-----------|
| L1 | Vague criticism. "Needs improvement." "Not good enough." No direction for how to fix. |
| L2 | Identifies specific issues. "The introduction is too long." Some suggestions. |
| L3 | Every criticism comes with a specific fix. "Move paragraph 3 to the opening — it has the hook. Current paragraph 1 is background that can go to section 2." |
| L4 | Feedback teaches. Agent who receives it understands not just WHAT to fix but WHY it matters and how to avoid the pattern in future work. |

**Level up via:** Feedback templates, "criticism + fix + principle" format requirement, feedback quality scoring.

**Current level:** L1 (system being built)

### 3. Pattern Recognition
*Seeing recurring issues across deliverables. Identifying systemic problems vs one-off mistakes.*

| Level | Looks Like |
|-------|-----------|
| L1 | Reviews each deliverable in isolation. Same feedback given repeatedly. |
| L2 | Notices when same issue appears twice. Flags it. |
| L3 | Tracks patterns across tasks and time. "This is the third dashboard with weak executive summaries — this is a skill gap, not a one-off." |
| L4 | Predicts issues before they appear based on patterns. "This task type + this agent role usually produces weak X — proactively address it in the brief." |

**Level up via:** Pattern tracking templates, cross-task review cadence, historical quality data analysis.

**Current level:** L1 (system being built)

### 4. Standards Evolution
*Updating the quality bar as the org improves. What was "good" last month should be "acceptable" this month.*

| Level | Looks Like |
|-------|-----------|
| L1 | Static standards. Same rubric forever. |
| L2 | Updates rubric when explicitly told to. |
| L3 | Proactively recommends rubric updates based on capability growth. "Our average dashboard storytelling is now 7 — we should raise the bar to require 8." |
| L4 | Drives org-wide quality culture. Standards evolve continuously. Benchmarks are fresh. The quality bar is always slightly ahead of current capability — creating productive tension. |

**Level up via:** Monthly benchmark refresh, capability-to-standard gap analysis, quality trend dashboards.

**Current level:** L1 (system being built)

---

## Updating Skill Levels

Skill levels are updated during the weekly division review based on:

1. **Quality scores** from completed tasks (primary signal)
2. **Consistency** — one great task doesn't make L3; 5 consistently great tasks do
3. **Trend** — improving, stable, or declining?

When updating a level:
- Log the change with evidence (which tasks demonstrated the new level)
- If moving UP: extract best practices into a playbook entry
- If moving DOWN: investigate why and create improvement plan

---

*Created: 2026-02-18 | Owner: {AI_NAME} (CEO) | Review cycle: Weekly (during division reviews)*
