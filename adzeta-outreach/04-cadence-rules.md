# AdZeta — Outreach Cadence Rules

## The Sequence: 14-Day Multi-Channel Cadence

```
Day 0:  Cold Email (Touch 1)          → Problem-aware opener
Day 2:  LinkedIn Connection Request    → Value-first note
Day 4:  Email Follow-Up (Touch 2)      → Social proof + value prop
Day 7:  LinkedIn Follow-Up Message     → Soft pitch (if accepted)
Day 14: Final Email (Touch 3)         → Breakup with clear CTA

Total Touches: 5 (3 email, 2 LinkedIn)
Duration: 14 days
Channels: Email, LinkedIn
```

---

## Detailed Timeline

### Day 0 — Initial Cold Email
- **Action:** Send Touch 1 email (problem-aware opener)
- **Time:** Tuesday-Thursday, 8:00-10:00 AM prospect local time
- **Tracking:** Monitor opens/clicks for 48 hours
- **Next:** If reply → exit sequence, move to conversation. If no reply → continue.

### Day 2 — LinkedIn Connection
- **Action:** Send LinkedIn connection request with value-first note
- **Prerequisite:** Research prospect's recent activity/posts for personalization
- **Note Length:** Max 300 characters
- **Next:** If accepted → mark for Day 7 follow-up. If not accepted → continue email sequence.

### Day 4 — Email Follow-Up
- **Action:** Send Touch 2 email (social proof + value prop)
- **Prerequisite:** Re-read Day 0 email, ensure no duplication
- **Test:** New subject line or same thread depending on open rates
- **Next:** Monitor for reply. If no reply → continue.

### Day 7 — LinkedIn Follow-Up
- **Action:** Send LinkedIn message (soft pitch)
- **Prerequisite:** Prospect accepted connection between Day 2-7
- **Conditions:**
  - If they replied to email → SKIP (already in conversation)
  - If they messaged on LinkedIn → SKIP, respond to thread
  - If never accepted connection → SKIP
- **Message:** Soft pitch with question/CTA

### Day 14 — Final Email
- **Action:** Send Touch 3 email (breakup)
- **Tone:** Respectful, clear, final
- **CTA:** Explicit permission-based close
- **Next:** Mark as "completed sequence - no reply" for nurture campaign

---

## Response Handling Rules

### If Prospect Replies (Any Channel)
1. **Immediately:** Pause all sequence steps
2. **Within 4 hours:** Respond to inquiry
3. **Qualify:** Discovery questions (see ICP validation)
4. **Route:** Calendar link if qualified, nurture if not
5. **Tag:** Update status in CRM/tracking sheet

### If Booked Meeting (Any Channel)
1. **Immediately:** Pause all sequence touches
2. **Confirm:** Meeting details sent to prospect
3. **Reminder:** 24-hour reminder email (optional)
4. **Post-Meeting:** Move to pipeline or re-sequence in 90 days

### If Hard Negative Response
1. **Immediately:** Stop all outreach
2. **Tag:** "Do Not Contact" in system
3. **Note reason:** If provided, log for feedback
4. **No future sequences:** Unless explicit permission given

### If Soft Negative ("not now", "later", etc.)
1. **Tag:** Nurture status
2. **Ask:** "When should I circle back?"
3. **Set reminder:** For date mentioned (or 90 days default)
4. **Add:** To quarterly nurture campaign

---

## Timing & Throttling

### Daily Volume Per Sender
| Channel | Daily Max | Notes |
|---------|-----------|-------|
| Cold Email | 30-50 | Scale up gradually from 20/day |
| LinkedIn Requests | 20-30 | Space throughout day |
| LinkedIn Messages | No limit | Only to connections |

### Safe Ramp Schedule (New Domain/Sender)
```
Week 1: 10 emails/day
Week 2: 20 emails/day
Week 3: 35 emails/day
Week 4+: 50 emails/day (monitor deliverability)
```

### Time Zone Rules
- **Primary:** Send in prospect's timezone
- **Secondary:** If unknown, use company HQ timezone
- **Tertiary:** Default to 9:00 AM ET (covers US business hours)

### Day-of-Week Distribution
| Day | Email Volume | LinkedIn Volume | Notes |
|-----|--------------|-----------------|-------|
| Monday | Low (10-15) | Medium (15) | Inboxes busy |
| Tuesday | High (50) | High (25) | Optimal day |
| Wednesday | High (50) | High (25) | Optimal day |
| Thursday | High (50) | High (25) | Optimal day |
| Friday | Low (10-20) | Low (10) | Lower response rates |

---

## Automation Rules

### Auto-Pause Triggers (Pause Sequence)
- [ ] Prospect replies to any email
- [ ] Prospect books meeting via calendar link
- [ ] Prospect responds on LinkedIn
- [ ] Manual flag from team member
- [ ] Bounce/invalid email detected

### Auto-Skip Conditions (Skip Specific Step)
- [ ] LinkedIn already connected → skip connection request
- [ ] Email replied → skip remaining email touches
- [ ] Already in active sequence → skip duplicate enrollment
- [ ] Competitor customer (known) → skip entirely

### Auto-Advance Conditions
- [ ] Email opened 3+ times → advance Touch 2 by 1 day (if urgent signal)
- [ ] Link clicked → trigger "high intent" alert to rep
- [ ] Profile viewed (LinkedIn) → consider connection request

---

## Tracking & Metrics

### Sequence KPIs
| Metric | Target | Tracking Method |
|--------|--------|-----------------|
| Email Open Rate | >45% | Email platform |
| Email Reply Rate | >5% | Email platform |
| LinkedIn Accept Rate | >30% | LinkedIn + CRM |
| LinkedIn Reply Rate | >10% | LinkedIn + CRM |
| Meeting Book Rate | >2% | Calendar system |
| Touch-to-Meeting Conversion | >3% | CRM calculation |

### A/B Testing Priorities
1. **Subject Lines:** Test 3 variants minimum per touch
2. **CTA:** Soft vs. hard ask ("worth a conversation?" vs. "book 15 mins")
3. **Social Proof:** Case study vs. metric vs. generic
4. **Timing:** Morning vs. afternoon sends

### Review Cadence
- **Daily:** Replies, meeting bookings, bounces
- **Weekly:** Sequence metrics, open/reply rates by variant
- **Monthly:** Full funnel analysis, ICP refinement

---

## Integration Points

### CRM Sync Requirements
- [ ] Contact creation on sequence enrollment
- [ ] Activity logging (emails sent, LinkedIn actions)
- [ ] Status updates (replied, booked, opted out)
- [ ] Custom fields: Signal, Tier, Sequence Step

### Calendar Integration
- [ ] Booked meetings auto-pause sequences
- [ ] Reminder emails pre-meeting
- [ ] No-show follow-up sequence trigger

### Team Notifications
- [ ] Reply received → Slack DM to assigned rep
- [ ] Meeting booked → Slack channel + email notification
- [ ] High-intent behavior (3+ opens) → daily digest

---

## Quick Reference: Decision Tree

```
PROSPECT STATUS → ACTION

No reply by Day 14 → Complete sequence, move to nurture
Reply (positive) → Pause, respond, qualify for meeting
Reply (soft no/not now) → Pause, set reminder, nurture
Reply (hard no) → Stop, DNC tag, remove from sequences
Booked meeting → Pause all touches, confirm details
LinkedIn accept + no message → Send Day 7 follow-up
LinkedIn accept + message → Pause email, respond on LI
Bounce/invalid → Remove from sequence, flag account
```
