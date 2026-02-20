# Product Process

## The Rule

No complex product work ships without a design phase. Brief → Design → Build → QA. Always.

## The Pipeline

```
1. HEAD OF PRODUCT — Brief
   What problem are we solving? Who is the user? What does success look like?
   Deliverable: Product brief with user stories and acceptance criteria.

2. UX EXPERT — Experience Design  
   How does the user think about this? What's the information architecture?
   Deliverable: Wireframes, user flows, IA diagram. No visual design yet — just structure.

3. DESIGN EXPERT — Visual Design
   How does it look and feel? Brand compliance? Typography hierarchy?
   Deliverable: Visual mockups or detailed design specs.

4. BUILDER(S) — Implementation
   Build exactly what was designed. Don't improvise the UX.
   Deliverable: Working code that matches the design.

5. QA / DESIGN REVIEW — Verification
   Does it match the design? Is the UX what was intended?
   Deliverable: Pass/fail with specific feedback.
```

## When This Applies

**Full pipeline (all 5 steps):**
- New product sections or pages
- Redesigns of existing features
- Anything shown to customers as "the product"

**Abbreviated (brief → build → QA):**
- Bug fixes to existing UX
- Adding data to an existing design
- Backend/API changes with no UX impact

**Skip entirely:**
- Pure backend work
- Documentation
- Process/config changes

## Agent Roles

| Role | What They Do | When Spawned |
|------|-------------|--------------|
| Head of Product | Writes the brief, owns the outcome, reviews all downstream work | Always first |
| UX Expert | Information architecture, user flows, wireframes, interaction design | After brief approved |
| Design Expert | Visual design, brand compliance, typography, spacing | After UX approved |
| Builder | Implementation to spec | After design approved |
| Design Reviewer | Compares build to design, flags deviations | After build complete |

## How Head of Product Orchestrates

1. Write the brief themselves
2. Spawn UX Expert with the brief → review wireframes
3. Spawn Design Expert with wireframes + brand guide → review visual design
4. Spawn Builder with design specs → review implementation
5. Spawn Design Reviewer for final QA

Each step is a checkpoint. Bad wireframes don't go to visual design. Bad visual design doesn't go to build.
