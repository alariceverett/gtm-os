/**
 * Sequence Builder
 * Build sequences from templates, natural language, or scratch
 */

import { 
  Sequence, 
  SequenceTemplate, 
  ParsedSequenceRequest, 
  Touch,
  TouchVariant,
  TouchContent,
  TouchCondition,
  SequenceConfig,
  SequenceVariant,
  ParsedTouch,
  SequenceBuilderConfig,
} from '@/types/sequences';

import { 
  SEQUENCE_TEMPLATES,
  getTemplate,
  getRecommendedTemplates,
  parseTemplateFromNL,
  DEFAULT_SEQUENCE_CONFIG,
} from './templates';

import { supabase } from '@/lib/supabase';

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_BUILDER_CONFIG: SequenceBuilderConfig = {
  defaultTimezone: 'America/New_York',
  businessHoursOnly: true,
  defaultConfidenceThreshold: 0.95,
  defaultMinSample: 100,
  autoCreateVariants: true,
  variantNamingStrategy: 'alphabet',
  variantWeights: [0.5, 0.5], // A/B: 50/50
};

// ============================================
// SEQUENCE BUILDER CLASS
// ============================================

export class SequenceBuilder {
  private config: SequenceBuilderConfig;
  private sequence: Partial<Sequence>;
  private db = supabase;

  constructor(config: Partial<SequenceBuilderConfig> = {}) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
    this.sequence = {
      status: 'draft',
      config: { ...DEFAULT_SEQUENCE_CONFIG },
      touches: [],
      variants: [],
      metrics: {
        enrolled: 0,
        active: 0,
        completed: 0,
        removed: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        booked: 0,
        bounced: 0,
        unsubscribed: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bookRate: 0,
        bounceRate: 0,
      },
    };
  }

  /**
   * Build sequence from natural language description
   * Example: "Create 3-touch: Day 1 email, Day 3 LinkedIn, Day 7 call"
   */
  static async fromNL(
    input: string,
    userId: string,
    workspaceId: string,
    builderConfig?: Partial<SequenceBuilderConfig>
  ): Promise<Sequence> {
    const builder = new SequenceBuilder(builderConfig);
    
    // Parse the natural language request
    const parsed = builder.parseNL(input);
    
    // Generate touches based on parsed request
    const touches = builder.generateTouchesFromParsed(parsed);
    
    // Build and save the sequence
    const sequence = await builder
      .withName(parsed.name || this.generateName(parsed))
      .withWorkspace(userId, workspaceId)
      .withTouches(touches)
      .withConfig({
        enableABTesting: parsed.variantCount ? parsed.variantCount > 1 : builder.config.autoCreateVariants,
      });

    // Auto-create variants if specified
    if (parsed.variantCount && parsed.variantCount > 1) {
      sequence.withVariants(parsed.variantCount, parsed.testMetric);
    }

    return sequence.build();
  }

  /**
   * Build sequence from a template
   */
  static async fromTemplate(
    templateId: string,
    userId: string,
    workspaceId: string,
    overrides?: {
      name?: string;
      description?: string;
      config?: Partial<SequenceConfig>;
    }
  ): Promise<Sequence> {
    const template = getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const builder = new SequenceBuilder();
    
    // Convert template touches to sequence touches
    const touches: Touch[] = template.touches.map((t, index) => ({
      id: builder.generateId(),
      sequenceId: '', // Will be set on build
      order: t.order,
      day: t.day,
      delayHours: t.delayHours,
      channel: t.channel,
      status: 'draft',
      autoSend: t.autoSend,
      condition: t.condition,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Create variants from template defaults
    const variants: SequenceVariant[] = [];
    if (template.defaultVariants) {
      for (const tv of template.defaultVariants) {
        variants.push({
          id: builder.generateId(),
          sequenceId: '',
          variantKey: tv.variantKey,
          name: tv.name,
          description: tv.description,
          weight: 1 / template.defaultVariants.length,
          touchVariants: tv.touchVariants || {},
          metrics: {
            enrolled: 0,
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            booked: 0,
            openRate: 0,
            clickRate: 0,
            replyRate: 0,
            bookRate: 0,
          },
          isControl: tv.variantKey === 'a',
        });
      }
    }

    // Build and save
    return builder
      .withName(overrides?.name || this.generateNameFromTemplate(template))
      .withDescription(overrides?.description || template.description)
      .withWorkspace(userId, workspaceId)
      .withTemplateId(templateId)
      .withConfig({ ...template.config, ...overrides?.config })
      .withTouches(touches)
      .withVariantsFromTemplate(variants)
      .build();
  }

  /**
   * Create new empty sequence builder
   */
  static create(
    userId: string,
    workspaceId: string,
    name?: string
  ): SequenceBuilder {
    const builder = new SequenceBuilder();
    builder.withName(name || 'Untitled Sequence');
    builder.withWorkspace(userId, workspaceId);
    return builder;
  }

  // ============================================
  // BUILDER METHODS (CHAINABLE)
  // ============================================

  withName(name: string): this {
    this.sequence.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.sequence.description = description;
    return this;
  }

  withWorkspace(userId: string, workspaceId: string): this {
    this.sequence.userId = userId;
    this.sequence.workspaceId = workspaceId;
    return this;
  }

  withTemplateId(templateId: string): this {
    this.sequence.templateId = templateId;
    return this;
  }

  withConfig(config: Partial<SequenceConfig>): this {
    this.sequence.config = {
      ...this.sequence.config,
      ...config,
    } as SequenceConfig;
    return this;
  }

  withTouches(touches: Touch[]): this {
    this.sequence.touches = touches.map((t, index) => ({
      ...t,
      order: t.order || index + 1,
    }));
    return this;
  }

  addTouch(touch: Partial<Touch>): this {
    const newTouch: Touch = {
      id: this.generateId(),
      sequenceId: this.sequence.id || '',
      order: (this.sequence.touches?.length || 0) + 1,
      day: touch.day ?? 1,
      channel: touch.channel || 'email',
      status: 'draft',
      autoSend: touch.autoSend ?? true,
      condition: touch.condition,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...touch,
    } as Touch;

    this.sequence.touches = [...(this.sequence.touches || []), newTouch];
    return this;
  }

  /**
   * Add touch variants for A/B testing
   */
  withVariants(count: number = 2, testMetric?: string): this {
    const variants: SequenceVariant[] = [];
    const variantNames = this.generateVariantNames(count);
    const weights = this.generateVariantWeights(count);

    for (let i = 0; i < count; i++) {
      const variantKey = ['a', 'b', 'c', 'd'][i] as 'a' | 'b' | 'c' | 'd';
      variants.push({
        id: this.generateId(),
        sequenceId: this.sequence.id || '',
        variantKey,
        name: variantNames[i],
        weight: weights[i],
        touchVariants: {},
        metrics: {
          enrolled: 0,
          sent: 0,
          opened: 0,
          clicked: 0,
          replied: 0,
          booked: 0,
          openRate: 0,
          clickRate: 0,
          replyRate: 0,
          bookRate: 0,
        },
        isControl: i === 0,
      });
    }

    this.sequence.variants = variants;
    return this;
  }

  /**
   * Set variants from template
   */
  withVariantsFromTemplate(variants: SequenceVariant[]): this {
    this.sequence.variants = variants;
    return this;
  }

  /**
   * Add A/B test content variants to a specific touch
   */
  addTouchVariant(
    touchId: string,
    variantKey: 'a' | 'b' | 'c' | 'd',
    content: TouchContent,
    name?: string
  ): this {
    // Find the associated touch
    const touch = this.sequence.touches?.find(t => t.id === touchId);
    if (!touch) {
      throw new Error(`Touch not found: ${touchId}`);
    }

    // This would typically create or update a TouchVariant record
    // For now, we track it in the sequence variants
    const sequenceVariant = this.sequence.variants?.find(v => v.variantKey === variantKey);
    if (sequenceVariant) {
      sequenceVariant.touchVariants[touchId] = variantKey;
    }

    return this;
  }

  /**
   * Enable automatic winner declaration
   */
  withAutoWinner(confidenceThreshold: number = 0.95, minSample: number = 100): this {
    return this.withConfig({
      autoDeclareWinner: true,
      confidenceThreshold,
      minSampleSize: minSample,
    });
  }

  /**
   * Validate the sequence before building
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.sequence.name || this.sequence.name.length < 2) {
      errors.push('Sequence name must be at least 2 characters');
    }

    if (!this.sequence.userId) {
      errors.push('User ID is required');
    }

    if (!this.sequence.workspaceId) {
      errors.push('Workspace ID is required');
    }

    if (!this.sequence.touches || this.sequence.touches.length === 0) {
      errors.push('Sequence must have at least one touch');
    }

    // Check for duplicate orders
    const orders = this.sequence.touches?.map(t => t.order) || [];
    if (new Set(orders).size !== orders.length) {
      errors.push('Touch orders must be unique');
    }

    // Validate A/B test weights sum to 1
    if (this.sequence.variants && this.sequence.variants.length > 0) {
      const totalWeight = this.sequence.variants.reduce((sum, v) => sum + v.weight, 0);
      if (Math.abs(totalWeight - 1) > 0.01) {
        errors.push(`Variant weights must sum to 1.0 (currently ${totalWeight.toFixed(2)})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Build and save the sequence
   */
  async build(): Promise<Sequence> {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Sequence validation failed: ${validation.errors.join(', ')}`);
    }

    const now = new Date();
    const sequenceId = this.generateId();

    // Finalize sequence object
    const sequence: Sequence = {
      id: sequenceId,
      name: this.sequence.name!,
      description: this.sequence.description,
      status: 'draft',
      userId: this.sequence.userId!,
      workspaceId: this.sequence.workspaceId!,
      config: this.sequence.config as SequenceConfig,
      touches: (this.sequence.touches || []).map(t => ({
        ...t,
        sequenceId,
        id: t.id || this.generateId(),
        createdAt: t.createdAt || now,
        updatedAt: now,
      })),
      variants: (this.sequence.variants || []).map(v => ({
        ...v,
        id: v.id || this.generateId(),
        sequenceId,
      })),
      metrics: this.sequence.metrics as Sequence['metrics'],
      templateId: this.sequence.templateId,
      createdAt: now,
      updatedAt: now,
    };

    // Save to database
    await this.saveSequence(sequence);

    return sequence;
  }

  /**
   * Preview the sequence without saving
   */
  preview(): Partial<Sequence> {
    return { ...this.sequence };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Parse natural language into structured request
   */
  private parseNL(input: string): ParsedSequenceRequest {
    const normalized = input.toLowerCase();
    
    // Extract touch count
    const touchMatch = input.match(/(\d+)\s*(?:touch|step|email|message)/i);
    const touchCount = touchMatch ? parseInt(touchMatch[1], 10) : undefined;

    // Extract duration
    const durationMatch = input.match(/(\d+)\s*(?:day|week|month)/i);
    let duration: number | undefined;
    if (durationMatch) {
      duration = parseInt(durationMatch[1], 10);
      if (normalized.includes('week')) duration *= 7;
      if (normalized.includes('month')) duration *= 30;
    }

    // Extract variant count
    const variantMatch = input.match(/(\d+)\s*variant|a\s*\/\s*b\s*test/i);
    const variantCount = variantMatch ? Math.max(2, parseInt(variantMatch[1], 10)) : 
      (normalized.includes('a/b') || normalized.includes('ab test') ? 2 : undefined);

    // Extract test metric
    const metricPatterns: Record<string, string> = {
      opens: 'open',
      clicks: 'click',
      replies: 'reply',
      meetings: 'meeting',
      books: 'book',
    };
    let testMetric: 'opens' | 'clicks' | 'replies' | 'meetings' | undefined;
    for (const [metric, pattern] of Object.entries(metricPatterns)) {
      if (normalized.includes(pattern)) {
        testMetric = metric as ParsedSequenceRequest['testMetric'];
        break;
      }
    }

    // Parse individual touches
    const touches = this.parseTouchesFromNL(input, touchCount);

    // Extract sequence name from input
    const nameMatch = input.match(/(?:called|named|"([^"]+)")/i);
    const name = nameMatch ? nameMatch[1] : undefined;

    // Calculate confidence
    const confidence = this.calculateParsingConfidence(input, {
      touchCount,
      duration,
      variantCount,
      touches,
    });

    return {
      intent: 'create',
      name,
      touchCount,
      duration,
      variantCount,
      testMetric,
      touches,
      raw: input,
      confidence,
    };
  }

  /**
   * Parse individual touches from NL input
   */
  private parseTouchesFromNL(input: string, expectedCount?: number): ParsedTouch[] {
    const normalized = input.toLowerCase();
    const touches: ParsedTouch[] = [];

    // Pattern: "day X channel" or "X days channel"
    const dayPattern = /(?:day\s*|:?\s*)(\d+)\s*(?::|,|\.|-|\s)(?:\s*)(email|linkedin|call|sms|voicemail|twitter)[\s\w]*/gi;
    const delayPattern = /(\d+)\s*(day|week|hour)s?\s*(?:later|after)?\s*(email|linkedin|call|sms|voicemail)/gi;

    let match;
    let order = 1;

    // Match day-based touches
    while ((match = dayPattern.exec(input)) !== null) {
      const day = parseInt(match[1], 10);
      const channel = this.normalizeChannel(match[2]);
      
      touches.push({
        order: order++,
        day,
        channel,
        description: match[0],
      });
    }

    // Match delay-based touches
    if (touches.length === 0) {
      while ((match = delayPattern.exec(input)) !== null) {
        const amount = parseInt(match[1], 10);
        const unit = match[2];
        const channel = this.normalizeChannel(match[3]);
        
        let day = amount;
        if (unit === 'week') day *= 7;
        if (unit === 'hour') day = Math.max(1, Math.round(amount / 24));

        touches.push({
          order: order++,
          day,
          delay: `${amount} ${unit}${amount > 1 ? 's' : ''}`,
          channel,
          description: match[0],
        });
      }
    }

    // If no touches parsed but count specified, generate defaults
    if (touches.length === 0 && expectedCount) {
      const spacing = normalized.includes('spread') ? 5 :
        normalized.includes('tight') ? 2 : 3;

      for (let i = 0; i < expectedCount; i++) {
        touches.push({
          order: i + 1,
          day: (i + 1) * spacing,
          channel: i === 0 ? 'email' : (i % 3 === 0 ? 'call' : 'email'),
          description: `Day ${(i + 1) * spacing} touch`,
        });
      }
    }

    // Detect tone/context from input
    const tone = (normalized.includes('formal') ? 'formal' :
      normalized.includes('casual') ? 'casual' :
      normalized.includes('direct') ? 'direct' :
      normalized.includes('value') ? 'value_first' : undefined);

    touches.forEach(t => t.tone = tone);

    // Detect focus areas
    if (normalized.includes('hiring') || normalized.includes('hire')) {
      touches.forEach(t => t.focus = 'hiring');
    } else if (normalized.includes('fund') || normalized.includes('raised')) {
      touches.forEach(t => t.focus = 'funding');
    } else if (normalized.includes('growth') || normalized.includes('expand')) {
      touches.forEach(t => t.focus = 'growth');
    }

    return touches.sort((a, b) => (a.day || 0) - (b.day || 0));
  }

  /**
   * Generate Touch objects from parsed request
   */
  private generateTouchesFromParsed(parsed: ParsedSequenceRequest): Touch[] {
    return parsed.touches.map((pt, index) => ({
      id: this.generateId(),
      sequenceId: '', // Set on build
      order: pt.order,
      day: pt.day || (index + 1) * 3,
      channel: pt.channel,
      status: 'draft',
      autoSend: index === 0, // First touch auto
      condition: index === 0 ? { type: 'always' } : { type: 'if_not_replied' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Normalize channel names
   */
  private normalizeChannel(channel: string): ParsedTouch['channel'] {
    const normalized = channel.toLowerCase().trim();
    
    if (normalized.includes('linkedin') || normalized.includes('linked')) return 'linkedin';
    if (normalized.includes('call') || normalized.includes('phone')) return 'call';
    if (normalized.includes('sms') || normalized.includes('text')) return 'sms';
    if (normalized.includes('voicemail')) return 'voicemail';
    if (normalized.includes('twitter') || normalized.includes('x')) return 'twitter';
    return 'email';
  }

  /**
   * Calculate parsing confidence
   */
  private calculateParsingConfidence(
    input: string,
    parsed: Partial<ParsedSequenceRequest>
  ): number {
    let confidence = 0.5;

    // Increase confidence with specific details
    if (parsed.touchCount) confidence += 0.15;
    if (parsed.duration) confidence += 0.1;
    if (parsed.variantCount) confidence += 0.1;
    if (parsed.touches && parsed.touches.length > 0) {
      confidence += 0.15;
      
      // Bonus for full parse
      if (parsed.touches.length === parsed.touchCount) {
        confidence += 0.1;
      }
    }

    // Penalize vague inputs
    if (input.length < 20) confidence -= 0.2;
    
    // Bonus for clear indicators
    if (/\d+\s+(touch|step|email)/i.test(input)) confidence += 0.1;
    if (/day\s*\d+/i.test(input)) confidence += 0.1;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate variant names
   */
  private generateVariantNames(count: number): string[] {
    const strategies = {
      alphabet: ['Variant A (Control)', 'Variant B', 'Variant C', 'Variant D'],
      descriptive: ['Control', 'Test Variant', 'Test Variant 2', 'Test Variant 3'],
    };

    const naming = strategies[this.config.variantNamingStrategy];
    return naming.slice(0, count);
  }

  /**
   * Generate variant weights
   */
  private generateVariantWeights(count: number): number[] {
    if (count === 2) return [0.5, 0.5];
    if (count === 3) return [0.34, 0.33, 0.33];
    if (count === 4) return [0.25, 0.25, 0.25, 0.25];
    return Array(count).fill(1 / count);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `seq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate name from parsed request
   */
  private static generateName(parsed: ParsedSequenceRequest): string {
    if (parsed.touches.length > 0) {
      const channels = [...new Set(parsed.touches.map(t => t.channel))];
      const channelStr = channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('/');
      return `${parsed.touches.length}-Touch ${channelStr} Sequence`;
    }
    return `Sequence ${new Date().toLocaleDateString()}`;
  }

  /**
   * Generate name from template
   */
  private static generateNameFromTemplate(template: SequenceTemplate): string {
    return `${template.name} (Copy)`;
  }

  /**
   * Save sequence to database
   */
  private async saveSequence(sequence: Sequence): Promise<void> {
    try {
      // Save sequence
      const { error: seqError } = await this.db
        .from('sequences')
        .insert({
          id: sequence.id,
          name: sequence.name,
          description: sequence.description,
          status: sequence.status,
          user_id: sequence.userId,
          workspace_id: sequence.workspaceId,
          config: sequence.config,
          template_id: sequence.templateId,
          ab_test_id: sequence.abTestId,
          created_at: sequence.createdAt,
          updated_at: sequence.updatedAt,
        });

      if (seqError) throw seqError;

      // Save touches
      if (sequence.touches.length > 0) {
        const { error: touchError } = await this.db
          .from('sequence_touches')
          .insert(sequence.touches.map(t => ({
            id: t.id,
            sequence_id: t.sequenceId,
            order_index: t.order,
            day: t.day,
            delay_hours: t.delayHours,
            channel: t.channel,
            status: t.status,
            auto_send: t.autoSend,
            condition_type: t.condition?.type,
            condition_logic: t.condition?.customLogic,
            created_at: t.createdAt,
            updated_at: t.updatedAt,
          })));

        if (touchError) throw touchError;
      }

      // Save variants
      if (sequence.variants && sequence.variants.length > 0) {
        const { error: variantError } = await this.db
          .from('sequence_variants')
          .insert(sequence.variants.map(v => ({
            id: v.id,
            sequence_id: v.sequenceId,
            variant_key: v.variantKey,
            name: v.name,
            description: v.description,
            weight: v.weight,
            touch_variants: v.touchVariants,
            is_control: v.isControl,
            is_winner: v.isWinner,
            confidence: v.confidence,
            metrics: v.metrics,
          })));

        if (variantError) throw variantError;
      }

    } catch (error) {
      console.error('Failed to save sequence:', error);
      throw error;
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Quick create sequence from NL
 */
export async function createSequenceFromNL(
  input: string,
  userId: string,
  workspaceId: string
): Promise<Sequence> {
  return SequenceBuilder.fromNL(input, userId, workspaceId);
}


/**
 * Duplicate an existing sequence
 */
export async function duplicateSequence(
  sequenceId: string,
  userId: string
): Promise<Sequence> {
  // Use the supabase client from lib/supabase
  
  // Fetch original sequence
  const { data: original, error } = await supabase
    .from('sequences')
    .select('*, touches:sequence_touches(*), variants:sequence_variants(*)')
    .eq('id', sequenceId)
    .single();

  if (error || !original) {
    throw new Error(`Sequence not found: ${sequenceId}`);
  }

  // Create builder with existing data
  const builder = new SequenceBuilder();
  
  builder
    .withName(`${original.name} (Copy)`)
    .withDescription(original.description)
    .withWorkspace(userId, original.workspace_id)
    .withConfig(original.config);

  // Copy touches
  if (original.touches) {
    const touches: Touch[] = original.touches.map((t: Touch) => ({
      id: builder['generateId'](), // Access private method
      sequenceId: '',
      order: t.order,
      day: t.day,
      channel: t.channel,
      status: 'draft',
      autoSend: t.autoSend,
      condition: t.condition,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    builder.withTouches(touches);
  }

  // Copy variants
  if (original.variants) {
    const variants: SequenceVariant[] = original.variants.map((v: SequenceVariant) => ({
      id: builder['generateId'](),
      sequenceId: '',
      variantKey: v.variantKey,
      name: v.name,
      description: v.description,
      weight: v.weight,
      touchVariants: v.touchVariants,
      metrics: {
        enrolled: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        booked: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        bookRate: 0,
      },
      isControl: v.isControl,
    }));
    builder.withVariantsFromTemplate(variants);
  }

  return builder.build();
}

/**
 * Get recommended templates for user
 */
export function getRecommendations(context: {
  hasMutualConnection?: boolean;
  isLinkedInConnected?: boolean;
  previousContact?: boolean;
  showedInterest?: boolean;
}): SequenceTemplate[] {
  return getRecommendedTemplates(context);
}

export default SequenceBuilder;
