/**
 * Sequence Templates
 * Pre-built, battle-tested sequence templates for common use cases
 */

import { SequenceTemplate, ParsedSequenceRequest, ParsedTouch } from '@/types/sequences';

export const DEFAULT_SEQUENCE_CONFIG = {
  timezone: 'America/New_York',
  businessHoursOnly: true,
  businessHoursStart: '09:00',
  businessHoursEnd: '17:00',
  respectProspectTimezone: true,
  skipWeekends: true,
  includeUnsubscribe: true,
  unsubscribeText: 'Unsubscribe',
  enableABTesting: true,
  autoDeclareWinner: true,
  confidenceThreshold: 0.95,
  minSampleSize: 100,
};

// ============================================
// INTRODUCTION SEQUENCES
// ============================================

export const INTRO_COLD_EMAIL: SequenceTemplate = {
  id: 'tpl_intro_cold_email',
  name: 'Cold Email Introduction',
  description: 'A professional 3-touch cold email sequence focusing on value proposition and gentle follow-ups',
  category: 'intro',
  difficulty: 'beginner',
  tags: ['cold-outreach', 'b2b', 'sales'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: '{{personalization.hook}}',
        body: `Hi {{prospect.firstName}},

{{personalization.opening}}

{{valueProp.oneLiner}}

{{socialProof.brief}}

{{cta.soft}}`,
        personalizationFields: ['prospect.firstName', 'company.name', 'personalization.hook', 'personalization.opening', 'valueProp.oneLiner', 'socialProof.brief', 'cta.soft'],
      },
      variants: [
        {
          variantKey: 'b',
          name: 'Direct Value',
          weight: 0.5,
          content: {
            subject: 'Quick question about {{company.name}}',
            body: `Hi {{prospect.firstName}},

I noticed {{company.name}} is {{signal.description}}. We help {{company.industry}} teams like yours {{valueProp.result}}.

{{caseStudy.oneLiner}}

Worth a brief conversation?`,
            personalizationFields: ['prospect.firstName', 'company.name', 'signal.description', 'company.industry', 'valueProp.result', 'caseStudy.oneLiner'],
          },
        },
      ],
    },
    {
      order: 2,
      day: 3,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_opened' },
      content: {
        subject: 'Re: {{personalization.hook}}',
        body: `Hi {{prospect.firstName}},

Wanted to bump this to the top of your inbox.

{{valueProp.short}}

{{socialProof.metric}}

{{cta.calendar}}`,
        personalizationFields: ['prospect.firstName', 'personalization.hook', 'valueProp.short', 'socialProof.metric', 'cta.calendar'],
      },
      variants: [
        {
          variantKey: 'b',
          name: 'Pattern Interrupt',
          weight: 0.5,
          content: {
            subject: '{{patternInterrupt.question}}',
            body: `Hey {{prospect.firstName}},

{{patternInterrupt.hook}}

{{valueProp.differentAngle}}

{{cta.lowFriction}}`,
            personalizationFields: ['prospect.firstName', 'patternInterrupt.question', 'patternInterrupt.hook', 'valueProp.differentAngle', 'cta.lowFriction'],
          },
        },
      ],
    },
    {
      order: 3,
      day: 7,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'Permission to close your loop?',
        body: `Hi {{prospect.firstName}},

I know you're busy. This is my last email—just wanted to make sure this doesn't fall through the cracks.

{{valueProp.final}}

If now's not the time, totally understand. Just reply "not now" and I'll check back in a few months.

{{cta.simple}}`,
        personalizationFields: ['prospect.firstName', 'valueProp.final', 'cta.simple'],
      },
    },
  ],
  defaultVariants: [
    { variantKey: 'a', name: 'Value First', description: 'Leads with educational value', touchVariants: {} },
    { variantKey: 'b', name: 'Direct Ask', description: 'Gets to the point quickly', touchVariants: { 1: 'b', 2: 'b' } },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const INTRO_LINKEDIN_MULTI: SequenceTemplate = {
  id: 'tpl_intro_linkedin_multi',
  name: 'LinkedIn Multi-Channel',
  description: 'Combines LinkedIn connection, engagement, and email for a multi-touch approach',
  category: 'intro',
  difficulty: 'intermediate',
  tags: ['linkedin', 'multi-channel', 'social-selling'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'linkedin',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        body: 'Hi {{prospect.firstName}}, noticed {{company.name}} is {{signal.description}}. Would love to connect and share some relevant insights.',        personalizationFields: ['prospect.firstName', 'company.name', 'signal.description'],
      },
    },
    {
      order: 2,
      day: 2,
      channel: 'email',
      autoSend: false,
      condition: { type: 'custom', customLogic: 'linkedin_accepted' },
      content: {
        subject: 'Following up on LinkedIn',
        body: `Hi {{prospect.firstName}},

Thanks for connecting! Saw your recent post about {{prospect.recentPost}}.

Given {{company.name}}'s focus on {{company.focus}}, thought you'd find this relevant:

{{valueProp.linkedInAngle}}

{{cta.conversation}}`,
        personalizationFields: ['prospect.firstName', 'prospect.recentPost', 'company.name', 'company.focus', 'valueProp.linkedInAngle', 'cta.conversation'],
      },
    },
    {
      order: 3,
      day: 5,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'Quick thought on {{company.name}}',
        body: `Hi {{prospect.firstName}},

Quick question: is {{challenge.area}} a priority for {{company.name}} right now?

We've helped similar {{company.industry}} companies {{result.metric}}.

{{cta.briefCall}}`,
        personalizationFields: ['prospect.firstName', 'company.name', 'challenge.area', 'company.industry', 'result.metric', 'cta.briefCall'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const INTRO_WARM_REFERRAL: SequenceTemplate = {
  id: 'tpl_intro_warm_referral',
  name: 'Warm Referral Approach',
  description: 'Leverages mutual connections or recent engagement for a warm introduction',
  category: 'intro',
  difficulty: 'beginner',
  tags: ['warm', 'referral', 'social-proof'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: '{{mutualConnection.name}} suggested I reach out',
        body: `Hi {{prospect.firstName}},

{{mutualConnection.name}} mentioned you're {{prospect.situation}} at {{company.name}}.

We just helped {{caseStudy.similarCompany}} {{caseStudy.result}} in {{caseStudy.timeline}}.

Thought it might be relevant. {{cta.quickChat}}`,
        personalizationFields: ['prospect.firstName', 'mutualConnection.name', 'prospect.situation', 'company.name', 'caseStudy.similarCompany', 'caseStudy.result', 'caseStudy.timeline', 'cta.quickChat'],
      },
    },
    {
      order: 2,
      day: 4,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'From {{mutualConnection.name}}',
        body: `Hi {{prospect.firstName}},

Following up on my note about {{valueProp.topic}}.

{{mutualConnection.name}} thought you'd find this particularly relevant given {{company.recentNews}}.

{{cta.calendarLink}}`,
        personalizationFields: ['prospect.firstName', 'mutualConnection.name', 'valueProp.topic', 'company.recentNews', 'cta.calendarLink'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================
// FOLLOW-UP SEQUENCES
// ============================================

export const FOLLOW_UP_INTERESTED: SequenceTemplate = {
  id: 'tpl_followup_interested',
  name: 'Interested Prospect Follow-Up',
  description: 'Nurture prospects who showed interest but went quiet',
  category: 'follow_up',
  difficulty: 'intermediate',
  tags: ['follow-up', 'nurture', 're-engage'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Following up on our conversation',
        body: `Hi {{prospect.firstName}},

You mentioned {{conversation.topic}} was interesting. Wanted to share {{resource.relevant}}.

{{resource.summary}}

Happy to discuss how this applies to {{company.name}} specifically.

{{cta.continue}}`,
        personalizationFields: ['prospect.firstName', 'conversation.topic', 'company.name', 'resource.relevant', 'resource.summary', 'cta.continue'],
      },
    },
    {
      order: 2,
      day: 5,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: '{{company.name}} + {{ourCompany.name}}: Next steps?',
        body: `Hi {{prospect.firstName}},

Understand you're evaluating options. Here's what sets us apart:

{{differentiator.point1}}
{{differentiator.point2}}
{{differentiator.point3}}

{{caseStudy.relevantDetail}}

{{cta.nextSteps}}`,
        personalizationFields: ['prospect.firstName', 'company.name', 'ourCompany.name', 'differentiator.point1', 'differentiator.point2', 'differentiator.point3', 'caseStudy.relevantDetail', 'cta.nextSteps'],
      },
    },
    {
      order: 3,
      day: 10,
      channel: 'call',
      autoSend: false,
      condition: { type: 'if_not_replied' },
      content: {
        body: 'Call {{prospect.firstName}} at {{prospect.phone}}. Reference previous emails about {{conversation.topic}}. Goal: get commitment on pilot/trial.',
        personalizationFields: ['prospect.firstName', 'prospect.phone', 'conversation.topic'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const FOLLOW_UP_MEETING_NO_SHOW: SequenceTemplate = {
  id: 'tpl_followup_meeting_noshow',
  name: 'Meeting No-Show Recovery',
  description: 'Graceful recovery sequence when a prospect misses a scheduled meeting',
  category: 'follow_up',
  difficulty: 'beginner',
  tags: ['no-show', 'meeting', 'recovery'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Missed you today',
        body: `Hi {{prospect.firstName}},

Looks like we missed each other today. No worries—scheduling can be tricky!

{{reschedule.link}}

Or feel free to suggest a time that works better.

Talk soon,
{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'reschedule.link', 'sender.name'],
      },
    },
    {
      order: 2,
      day: 2,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'Quick reshare: {{meeting.topic}}',
        body: `Hi {{prospect.firstName}},

Wanted to reshare what we were going to discuss:

{{meeting.agenda}}

Still interested? {{reschedule.link}}

If priorities have shifted, totally understand. Just let me know.

Best,
{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'meeting.topic', 'meeting.agenda', 'reschedule.link', 'sender.name'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================
// RE-ENGAGEMENT SEQUENCES
// ============================================

export const REENGAGE_COLD: SequenceTemplate = {
  id: 'tpl_reengage_cold',
  name: 'Cold Re-Engagement',
  description: 'Re-activate prospects who went dark after initial outreach',
  category: 're_engagement',
  difficulty: 'intermediate',
  tags: ['re-engage', 'nurture', 'long-term'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Still on your radar?',
        body: `Hi {{prospect.firstName}},

Reaching back out—I know things get busy.

Since we last spoke, {{company.update}}. Wondering if {{valueProp.topic}} is more relevant now.

{{new.resource}} might be worth a look.

{{cta.soft}}`,
        personalizationFields: ['prospect.firstName', 'company.update', 'valueProp.topic', 'new.resource', 'cta.soft'],
      },
    },
    {
      order: 2,
      day: 14,
      channel: 'linkedin',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        body: 'Hey {{prospect.firstName}}, saw {{company.recentNews}}. Congrats! Would love to reconnect when timing is better.',
        personalizationFields: ['prospect.firstName', 'company.recentNews'],
      },
    },
    {
      order: 3,
      day: 30,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'Checking in—last try',
        body: `Hi {{prospect.firstName}},

Last email from me. {{valueProp.quickReminder}}

If there's ever a fit, you know where to find me.

{{sender.signature}}`,
        personalizationFields: ['prospect.firstName', 'valueProp.quickReminder', 'sender.signature'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const REENGAGE_BREAKUP: SequenceTemplate = {
  id: 'tpl_reengage_breakup',
  name: 'The Breakup',
  description: 'Final attempt to engage with pattern interrupt and FOMO',
  category: 're_engagement',
  difficulty: 'beginner',
  tags: ['breakup', 'final', 'pattern-interrupt'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Should I close your file?',
        body: `Hi {{prospect.firstName}},

I've reached out a few times about {{valueProp.topic}} but haven't heard back.

Figured I'd try one last time—if now's not the time, totally get it.

But if {{company.name}} is still dealing with {{pain.point}}, might be worth a 10-min conversation.

If I don't hear back, I'll assume priorities have shifted and close your file.

{{cta.lastChance}}`,
        personalizationFields: ['prospect.firstName', 'valueProp.topic', 'company.name', 'pain.point', 'cta.lastChance'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================
// NURTURE SEQUENCES
// ============================================

export const NURTURE_VALUE_DRIP: SequenceTemplate = {
  id: 'tpl_nurture_value_drip',
  name: 'Value Drip Nurture',
  description: 'Long-term nurture sequence delivering consistent value',
  category: 'nurture',
  difficulty: 'advanced',
  tags: ['nurture', 'value', 'long-term', 'content'],
  config: {
    ...DEFAULT_SEQUENCE_CONFIG,
    skipWeekends: true,
    maxEmailsPerDay: 1,
  },
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Resource for {{company.name}}',
        body: `Hi {{prospect.firstName}},

Came across this {{resource.type}} and thought of {{company.name}}:

{{resource.title}}

Key takeaway: {{resource.insight}}

No pitch, just thought you'd find it valuable.

Best,
{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'company.name', 'resource.type', 'resource.title', 'resource.insight', 'sender.name'],
      },
    },
    {
      order: 2,
      day: 14,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: '{{industry.trend}} insights',
        body: `Hi {{prospect.firstName}},

Been researching {{industry.trend}} and found some interesting data:

{{research.finding}}

{{insight.application}}

More here if curious: {{resource.link}}

Cheers,
{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'industry.trend', 'research.finding', 'insight.application', 'resource.link', 'sender.name'],
      },
    },
    {
      order: 3,
      day: 30,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Worth a conversation?',
        body: `Hi {{prospect.firstName}},

Hope those resources have been helpful.

Quick ask: is {{pain.point}} on your roadmap for {{timeframe}}?

{{valueProp.soft}}

If yes, happy to share more. If not, I'll keep sending helpful stuff either way.

{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'pain.point', 'timeframe', 'valueProp.soft', 'sender.name'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================
// BOOK MEETING SEQUENCES
// ============================================

export const BOOK_MEETING_DIRECT: SequenceTemplate = {
  id: 'tpl_book_meeting_direct',
  name: 'Direct Meeting Request',
  description: 'Short, direct sequence focused on booking a meeting',
  category: 'book_meeting',
  difficulty: 'beginner',
  tags: ['meeting', 'direct', 'short'],
  config: DEFAULT_SEQUENCE_CONFIG,
  touches: [
    {
      order: 1,
      day: 0,
      channel: 'email',
      autoSend: true,
      condition: { type: 'always' },
      content: {
        subject: 'Quick chat about {{company.name}}?',
        body: `Hi {{prospect.firstName}},

{{personalization.relevantFinding}}

Worth a brief conversation?

{{calendar.directLink}}

Best,
{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'company.name', 'personalization.relevantFinding', 'calendar.directLink', 'sender.name'],
      },
    },
    {
      order: 2,
      day: 3,
      channel: 'email',
      autoSend: true,
      condition: { type: 'if_not_replied' },
      content: {
        subject: 'Re: Quick chat',
        body: `Hi {{prospect.firstName}},

Bumping this up. Even 10 minutes would work.

{{valueProp.oneSentence}}

{{calendar.directLink}}

{{sender.name}}`,
        personalizationFields: ['prospect.firstName', 'valueProp.oneSentence', 'calendar.directLink', 'sender.name'],
      },
    },
  ],
  useCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ============================================
// TEMPLATE REGISTRY
// ============================================

export const SEQUENCE_TEMPLATES: Record<string, SequenceTemplate> = {
  'intro-cold-email': INTRO_COLD_EMAIL,
  'intro-linkedin-multi': INTRO_LINKEDIN_MULTI,
  'intro-warm-referral': INTRO_WARM_REFERRAL,
  'followup-interested': FOLLOW_UP_INTERESTED,
  'followup-meeting-noshow': FOLLOW_UP_MEETING_NO_SHOW,
  'reengage-cold': REENGAGE_COLD,
  'reengage-breakup': REENGAGE_BREAKUP,
  'nurture-value-drip': NURTURE_VALUE_DRIP,
  'book-meeting-direct': BOOK_MEETING_DIRECT,
};

export const TEMPLATE_CATEGORIES = [
  { id: 'intro', label: 'Introduction', icon: 'Handshake' },
  { id: 'follow_up', label: 'Follow-up', icon: 'RefreshCw' },
  { id: 're_engagement', label: 'Re-engagement', icon: 'UserPlus' },
  { id: 'nurture', label: 'Nurture', icon: 'Heart' },
  { id: 'book_meeting', label: 'Book Meeting', icon: 'Calendar' },
  { id: 'breakup', label: 'Breakup', icon: 'XCircle' },
] as const;

/**
 * Get template by ID
 */
export function getTemplate(id: string): SequenceTemplate | undefined {
  return SEQUENCE_TEMPLATES[id];
}

/**
 * Get all templates as array
 */
export function getAllTemplates(): SequenceTemplate[] {
  return Object.values(SEQUENCE_TEMPLATES);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): SequenceTemplate[] {
  return Object.values(SEQUENCE_TEMPLATES).filter(t => t.category === category);
}

/**
 * Get templates by difficulty
 */
export function getTemplatesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): SequenceTemplate[] {
  return Object.values(SEQUENCE_TEMPLATES).filter(t => t.difficulty === difficulty);
}

/**
 * Search templates by tags or name
 */
export function searchTemplates(query: string): SequenceTemplate[] {
  const normalizedQuery = query.toLowerCase();
  return Object.values(SEQUENCE_TEMPLATES).filter(t => 
    t.name.toLowerCase().includes(normalizedQuery) ||
    t.description.toLowerCase().includes(normalizedQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
  );
}

/**
 * Get recommended templates based on user context
 */
export function getRecommendedTemplates(context: {
  hasMutualConnection?: boolean;
  isLinkedInConnected?: boolean;
  previousContact?: boolean;
  showedInterest?: boolean;
  industry?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}): SequenceTemplate[] {
  const recommendations: SequenceTemplate[] = [];
  
  if (context.hasMutualConnection) {
    recommendations.push(INTRO_WARM_REFERRAL);
  }
  
  if (context.isLinkedInConnected) {
    recommendations.push(INTRO_LINKEDIN_MULTI);
  }
  
  if (context.showedInterest) {
    recommendations.push(FOLLOW_UP_INTERESTED);
  } else if (context.previousContact) {
    recommendations.push(REENGAGE_COLD);
  } else {
    recommendations.push(INTRO_COLD_EMAIL);
  }
  
  // Filter by difficulty if specified
  if (context.difficulty) {
    return recommendations.filter(t => t.difficulty === context.difficulty);
  }
  
  return recommendations;
}

/**
 * Parse natural language to template ID
 */
export function parseTemplateFromNL(input: string): string | null {
  const normalized = input.toLowerCase();
  
  // Category detection
  if (normalized.includes('intro') || normalized.includes('cold') || normalized.includes('first')) {
    if (normalized.includes('linkedin') || normalized.includes('connect')) {
      return 'intro-linkedin-multi';
    }
    if (normalized.includes('warm') || normalized.includes('referral') || normalized.includes('connection')) {
      return 'intro-warm-referral';
    }
    return 'intro-cold-email';
  }
  
  if (normalized.includes('follow') || normalized.includes('follow-up') || normalized.includes('nurture')) {
    if (normalized.includes('no show') || normalized.includes('missed') || normalized.includes('meeting')) {
      return 'followup-meeting-noshow';
    }
    return 'followup-interested';
  }
  
  if (normalized.includes('reengage') || normalized.includes('re-engage') || normalized.includes('reactivate')) {
    if (normalized.includes('breakup') || normalized.includes('last') || normalized.includes('final')) {
      return 'reengage-breakup';
    }
    return 'reengage-cold';
  }
  
  if (normalized.includes('meeting') || normalized.includes('book') || normalized.includes('calendar')) {
    return 'book-meeting-direct';
  }
  
  if (normalized.includes('nurture') || normalized.includes('drip') || normalized.includes('value')) {
    return 'nurture-value-drip';
  }
  
  // Default
  return 'intro-cold-email';
}

export default SEQUENCE_TEMPLATES;
