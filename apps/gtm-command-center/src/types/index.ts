/**
 * Types for AdZeta Agentic Outreach UI
 * Natural language first, MCP-powered prospecting
 */

// Command Intent parsed from natural language
export interface CommandIntent {
  action: 'research' | 'enrich' | 'campaign' | 'sequence' | 'analyze' | 'export';
  icp?: {
    titles?: string[];
    industries?: string[];
    companySize?: string;
    locations?: string[];
    signals?: string[];
    fundingStage?: string[];
    technologies?: string[];
  };
  campaign?: {
    name?: string;
    variantCount?: number;
    touchCount?: number;
    focus?: string;
  };
  filters?: {
    minScore?: number;
    requireEmail?: boolean;
    requirePhone?: boolean;
    excludeContacted?: boolean;
  };
  query?: string;
  rawInput: string;
  confidence: number;
}

// Prospect with scoring
export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  company: string;
  companyDomain?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  photoUrl?: string;
  score: number;
  scoreGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
  signals: ProspectSignal[];
  lastContacted?: Date;
  lastContactType?: 'email' | 'call' | 'linkedin' | 'meeting';
  enrichedAt?: Date;
  confidence: number;
}

// Buying signals
export interface ProspectSignal {
  type: 'hiring' | 'funding' | 'growth' | 'expansion' | 'tech_stack' | 'intent' | 'engagement' | 'news';
  label: string;
  description: string;
  timestamp: Date;
  source: string;
  strength: 'high' | 'medium' | 'low';
}

// Research job progress
export interface ResearchJob {
  id: string;
  status: 'pending' | 'running' | 'enriching' | 'scoring' | 'completed' | 'error';
  query: string;
  intent: CommandIntent;
  progress: {
    found: number;
    enriched: number;
    scored: number;
    target?: number;
  };
  results: Prospect[];
  error?: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Campaign sequence
export interface Sequence {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  touches: SequenceTouch[];
  variants: SequenceVariant[];
  prospects: string[]; // Prospect IDs
  metrics: SequenceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceTouch {
  id: string;
  day: number;
  type: 'email' | 'linkedin' | 'call' | 'sms' | 'voicemail';
  order: number;
  variantA?: TouchContent;
  variantB?: TouchContent;
  autoSend?: boolean;
  condition?: 'always' | 'opened' | 'replied' | 'not_opened' | 'linked_in_accepted';
}

export interface TouchContent {
  subject?: string;
  body: string;
  personalizedFields: string[];
}

export interface SequenceVariant {
  id: string;
  name: string;
  split: number; // Percentage (0-100)
  isWinning?: boolean;
  metrics: VariantMetrics;
}

export interface SequenceMetrics {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  unsubscribed: number;
  openRate: number;
  replyRate: number;
  bookRate: number;
}

export interface VariantMetrics {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  booked: number;
  openRate: number;
  replyRate: number;
}

// Suggestion card
export interface Suggestion {
  id: string;
  type: 'campaign' | 'sequence' | 'prospect' | 'optimization' | 'insight';
  title: string;
  description: string;
  context?: string;
  actionLabel: string;
  actionType: string;
  data?: unknown;
  priority: 'high' | 'medium' | 'low';
}

// Thread item
export interface ThreadItem {
  id: string;
  type: 'command' | 'result' | 'suggestion' | 'action' | 'system';
  content: string;
  data?: unknown;
  timestamp: Date;
  parentId?: string;
  branchIds?: string[];
  isModified?: boolean;
  modifiedFrom?: string;
}

// Realtime update
export interface RealtimeUpdate {
  type: 'job_progress' | 'prospect_added' | 'score_updated' | 'sequence_update';
  jobId?: string;
  prospectId?: string;
  sequenceId?: string;
  payload: unknown;
  timestamp: Date;
}
