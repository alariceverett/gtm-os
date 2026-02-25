/**
 * Extended Sequence Types for AdZeta
 * Building blocks for sequence creation, management, and A/B testing
 */

// Channel types for outreach touches
export type TouchChannel = 'email' | 'linkedin' | 'call' | 'sms' | 'voicemail' | 'twitter' | 'custom';

// Touch status tracking
export type TouchStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'failed' | 'skipped';

// Sequence status
export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

// A/B Test status
export type ABTestStatus = 'pending' | 'running' | 'paused' | 'complete' | 'winner_declared';

/**
 * Base touch structure - a single outreach step
 */
export interface Touch {
  id: string;
  sequenceId: string;
  order: number; // 1-based order in sequence
  day: number; // Days after sequence start
  delayHours?: number; // Alternative: hours after previous touch
  channel: TouchChannel;
  status: TouchStatus;
  autoSend: boolean;
  condition?: TouchCondition;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Condition for when a touch should be sent
 */
export interface TouchCondition {
  type: 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked' | 'if_replied' | 'if_not_replied' | 'custom';
  previousTouchId?: string;
  customLogic?: string; // For advanced conditions
}

/**
 * Content variant for a touch (A/B testing)
 */
export interface TouchVariant {
  id: string;
  touchId: string;
  variantKey: 'a' | 'b' | 'c' | 'd'; // Support up to 4 variants
  name: string; // e.g., "Direct Approach", "Value First"
  content: TouchContent;
  weight: number; // Traffic split (0-1, default 0.5 for A/B)
  isControl?: boolean;
  metrics: VariantTouchMetrics;
  createdAt: Date;
}

/**
 * Content for a touch
 */
export interface TouchContent {
  subject?: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  // Personalization fields to extract
  personalizationFields: string[];
  // Dynamic snippets
  snippets?: Record<string, string>;
  // Attachments
  attachments?: Attachment[];
  // CTA configuration
  cta?: {
    text: string;
    url?: string;
  };
}

/**
 * Attachment for email touches
 */
export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

/**
 * Full sequence structure
 */
export interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  userId: string;
  workspaceId: string;
  
  // Configuration
  config: SequenceConfig;
  
  // Relationships
  touches: Touch[];
  variants?: SequenceVariant[]; // A/B test variants at sequence level
  prospects?: SequenceProspect[];
  
  // Metrics
  metrics: SequenceMetrics;
  
  // Metadata
  templateId?: string; // If created from template
  abTestId?: string; // If part of an A/B test
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sequence-level variant for A/B testing entire sequences
 */
export interface SequenceVariant {
  id: string;
  sequenceId: string;
  variantKey: 'a' | 'b' | 'c' | 'd';
  name: string;
  description?: string;
  weight: number;
  touchVariants: Record<string, string>; // touchId -> variantId mapping
  metrics: VariantSequenceMetrics;
  isControl?: boolean;
  isWinner?: boolean;
  confidence?: number;
}

/**
 * Prospect enrolled in a sequence
 */
export interface SequenceProspect {
  id: string;
  sequenceId: string;
  prospectId: string;
  variantKey: string | null; // Assigned A/B variant
  status: 'enrolled' | 'active' | 'paused' | 'completed' | 'removed';
  currentTouchIndex: number;
  enrolledAt: Date;
  completedAt?: Date;
  metrics: ProspectSequenceMetrics;
}

/**
 * Sequence configuration
 */
export interface SequenceConfig {
  // Scheduling
  timezone: string;
  businessHoursOnly: boolean;
  businessHoursStart: string; // "09:00"
  businessHoursEnd: string; // "17:00"
  respectProspectTimezone: boolean;
  skipWeekends: boolean;
  
  // Safety limits
  maxEmailsPerDay?: number;
  throttleMs?: number;
  
  // Unsubscribe
  includeUnsubscribe: boolean;
  unsubscribeText?: string;
  
  // A/B Testing
  enableABTesting: boolean;
  autoDeclareWinner: boolean;
  confidenceThreshold: number;
  minSampleSize: number;
}

/**
 * Metrics for a sequence
 */
export interface SequenceMetrics {
  enrolled: number;
  active: number;
  completed: number;
  removed: number;
  
  // Engagement
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  bounced: number;
  unsubscribed: number;
  
  // Rates
  openRate: number;
  clickRate: number;
  replyRate: number;
  bookRate: number;
  bounceRate: number;
}

/**
 * Metrics for a variant at the sequence level
 */
export interface VariantSequenceMetrics {
  enrolled: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  
  // Calculated rates
  openRate: number;
  clickRate: number;
  replyRate: number;
  bookRate: number;
}

/**
 * Metrics for a variant at the touch level
 */
export interface VariantTouchMetrics {
  sent: number;
  opened: number;
  uniqueOpens: number;
  clicked: number;
  uniqueClicks: number;
  replied: number;
  bounced: number;
  
  // Calculated rates
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

/**
 * Metrics for a prospect in a sequence
 */
export interface ProspectSequenceMetrics {
  touchesSent: number;
  touchesOpened: number;
  touchesClicked: number;
  touchedReplied: number;
  firstTouchAt?: Date;
  lastTouchAt?: Date;
  lastOpenAt?: Date;
  lastClickAt?: Date;
  repliedAt?: Date;
  bookedAt?: Date;
}

/**
 * A/B Test definition
 */
export interface ABTest {
  id: string;
  name: string;
  description?: string;
  type: 'touch' | 'sequence'; // Testing individual touches vs entire sequences
  
  // For touch-level testing
  sequenceId?: string;
  touchId?: string;
  
  // For sequence-level testing
  sequenceIds?: string[];
  
  // Variants
  variants: ABTestVariant[];
  
  // Configuration
  split: number; // Default split (0.5 = 50/50)
  minSample: number;
  maxSample?: number;
  confidenceThreshold: number; // e.g., 0.95 for 95%
  
  // Primary metric for determining winner
  primaryMetric: 'openRate' | 'clickRate' | 'replyRate' | 'bookRate';
  
  // Status
  status: ABTestStatus;
  winningVariantId?: string;
  confidence?: number;
  
  // Schedule
  startedAt?: Date;
  endedAt?: Date;
  autoEndAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Variant within an A/B test
 */
export interface ABTestVariant {
  id: string;
  testId: string;
  variantKey: string; // 'a', 'b', 'c', 'd'
  name: string;
  weight: number; // Traffic allocation (0-1)
  
  // For sequence-level tests
  touchVariants?: Record<string, string>; // Which variant to use for each touch
  
  // Metrics
  sampleSize: number;
  metrics: VariantSequenceMetrics;
  
  // Winning
  isControl: boolean;
  isWinner?: boolean;
  confidenceVsControl?: number;
}

/**
 * Event for tracking A/B test interactions
 */
export interface ABTestEvent {
  id: string;
  testId: string;
  variantId: string;
  prospectId: string;
  sequenceId: string;
  touchId?: string;
  eventType: 'enroll' | 'send' | 'open' | 'click' | 'reply' | 'book' | 'bounce' | 'unsubscribe';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Statistical result for A/B test analysis
 */
export interface ABTestResult {
  testId: string;
  variantId: string;
  variantKey: string;
  sampleSize: number;
  metrics: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bookRate: number;
  };
  // Statistical calculations
  statistics: {
    confidenceInterval: [number, number];
    standardError: number;
    zScore?: number;
    pValue?: number;
    significant: boolean;
    liftVsControl?: number; // Percentage improvement
  };
}

/**
 * Template for pre-built sequences
 */
export interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  category: 'intro' | 'follow_up' | 're_engagement' | 'nurture' | 'book_meeting' | 'breakup' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  
  // Template structure
  config: SequenceConfig;
  touches: TemplateTouch[];
  
  // Pre-built variants for A/B testing
  defaultVariants?: TemplateVariant[];
  
  // Metadata
  createdBy?: string;
  useCount: number;
  avgPerformance?: {
    openRate: number;
    replyRate: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Touch within a template
 */
export interface TemplateTouch {
  order: number;
  day: number;
  delayHours?: number;
  channel: TouchChannel;
  autoSend: boolean;
  condition?: TouchCondition;
  
  // Default content (variant A)
  content: TouchContent;
  
  // Alternative variants
  variants?: TemplateTouchVariant[];
}

/**
 * Variant within a template touch
 */
export interface TemplateTouchVariant {
  variantKey: 'a' | 'b' | 'c' | 'd';
  name: string;
  content: TouchContent;
  weight: number;
}

/**
 * Variant configuration within a template
 */
export interface TemplateVariant {
  variantKey: 'a' | 'b' | 'c' | 'd';
  name: string;
  description?: string;
  // Override specific touches
  touchVariants: Record<number, string>; // order -> variantKey
}

/**
 * Parsed natural language sequence request
 */
export interface ParsedSequenceRequest {
  intent: 'create' | 'modify' | 'duplicate';
  name?: string;
  touchCount?: number;
  touches: ParsedTouch[];
  
  // A/B testing config from NL
  variantCount?: number;
  testMetric?: 'opens' | 'clicks' | 'replies' | 'meetings';
  
  // Timing
  duration?: number; // Total days
  spacing?: 'tight' | 'normal' | 'spread';
  
  // Raw metadata
  raw: string;
  confidence: number;
}

/**
 * Individual touch parsed from natural language
 */
export interface ParsedTouch {
  order: number;
  day?: number;
  delay?: string; // e.g., "3 days", "1 week"
  channel: TouchChannel;
  description?: string;
  focus?: string; // e.g., "hiring", "funding news"
  tone?: 'formal' | 'casual' | 'direct' | 'value_first';
}

/**
 * Builder configuration for sequence creation
 */
export interface SequenceBuilderConfig {
  defaultTimezone: string;
  businessHoursOnly: boolean;
  defaultConfidenceThreshold: number;
  defaultMinSample: number;
  autoCreateVariants: boolean;
  variantNamingStrategy: 'alphabet' | 'descriptive';
  variantWeights: number[]; // e.g., [0.5, 0.5] for A/B
}
