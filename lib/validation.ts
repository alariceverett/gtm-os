/**
 * Validation Utilities for API Endpoints
 * 
 * Simple validation functions without external dependencies
 */

// ============================================================================
// UUID VALIDATION
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value);
}

// ============================================================================
// EMAIL SEQUENCES
// ============================================================================

export const sequenceTypeValues = ['cold_outreach', 'nurture', 're_engagement', 'follow_up'] as const;
export const sequenceStatusValues = ['draft', 'active', 'paused', 'archived'] as const;

export interface SequenceStepInput {
  step_number: number;
  template_id?: string;
  subject_override?: string;
  body_override?: string;
  wait_days?: number;
  wait_hours?: number;
  wait_minutes?: number;
  send_window_start?: string;
  send_window_end?: string;
  respect_weekends?: boolean;
  condition_config?: Record<string, unknown>;
  variant_for?: string;
  is_active?: boolean;
}

export function validateCreateSequence(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // Required fields
  if (!isString(data.slug) || data.slug.length === 0 || data.slug.length > 100) {
    errors.push('slug: Must be a non-empty string between 1 and 100 characters');
  }
  if (!isString(data.name) || data.name.length === 0 || data.name.length > 200) {
    errors.push('name: Must be a non-empty string between 1 and 200 characters');
  }

  // Optional fields
  if (data.description && (!isString(data.description) || data.description.length > 1000)) {
    errors.push('description: Must be a string with max 1000 characters');
  }
  if (data.sequence_type && !sequenceTypeValues.includes(data.sequence_type as typeof sequenceTypeValues[number])) {
    errors.push('sequence_type: Must be one of: cold_outreach, nurture, re_engagement, follow_up');
  }
  if (data.status && !sequenceStatusValues.includes(data.status as typeof sequenceStatusValues[number])) {
    errors.push('status: Must be one of: draft, active, paused, archived');
  }

  // Steps validation
  if (!isArray(data.steps) || data.steps.length === 0) {
    errors.push('steps: Must be a non-empty array');
  } else if (data.steps.length > 50) {
    errors.push('steps: Maximum 50 steps allowed');
  } else {
    data.steps.forEach((step, index) => {
      const stepErrors = validateSequenceStep(step, `steps[${index}]`);
      errors.push(...stepErrors);
    });
  }

  return { valid: errors.length === 0, errors };
}

export function validateUpdateSequence(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, errors: ['At least one field must be provided'] };
  }

  // Optional field validation
  if (data.name && (!isString(data.name) || data.name.length === 0 || data.name.length > 200)) {
    errors.push('name: Must be a non-empty string between 1 and 200 characters');
  }
  if (data.description && (!isString(data.description) || data.description.length > 1000)) {
    errors.push('description: Must be a string with max 1000 characters');
  }
  if (data.sequence_type && !sequenceTypeValues.includes(data.sequence_type as typeof sequenceTypeValues[number])) {
    errors.push('sequence_type: Must be one of: cold_outreach, nurture, re_engagement, follow_up');
  }
  if (data.status && !sequenceStatusValues.includes(data.status as typeof sequenceStatusValues[number])) {
    errors.push('status: Must be one of: draft, active, paused, archived');
  }

  // Steps validation if provided
  if (data.steps) {
    if (!isArray(data.steps)) {
      errors.push('steps: Must be an array');
    } else {
      data.steps.forEach((step, index) => {
        const stepErrors = validateSequenceStep(step, `steps[${index}]`);
        errors.push(...stepErrors);
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateSequenceStep(step: unknown, prefix: string): string[] {
  const errors: string[] = [];

  if (!isObject(step)) {
    return [`${prefix}: Must be an object`];
  }

  if (!isNumber(step.step_number) || step.step_number < 0 || step.step_number > 50) {
    errors.push(`${prefix}.step_number: Must be a number between 0 and 50`);
  }
  if (step.template_id && !isValidUUID(step.template_id)) {
    errors.push(`${prefix}.template_id: Must be a valid UUID`);
  }
  if (step.subject_override && (!isString(step.subject_override) || step.subject_override.length > 500)) {
    errors.push(`${prefix}.subject_override: Max 500 characters`);
  }
  if (step.wait_days && (!isNumber(step.wait_days) || step.wait_days < 0 || step.wait_days > 365)) {
    errors.push(`${prefix}.wait_days: Must be between 0 and 365`);
  }

  return errors;
}

export function validateSequenceQuery(data: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  const validStatuses = ['all', 'draft', 'active', 'paused', 'archived'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status: Must be one of: ${validStatuses.join(', ')}`);
  }

  if (data.sequence_type && !sequenceTypeValues.includes(data.sequence_type as typeof sequenceTypeValues[number])) {
    errors.push(`sequence_type: Must be one of: ${sequenceTypeValues.join(', ')}`);
  }

  const limit = parseInt(data.limit || '20', 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('limit: Must be between 1 and 100');
  }

  const offset = parseInt(data.offset || '0', 10);
  if (isNaN(offset) || offset < 0) {
    errors.push('offset: Must be non-negative');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export const templateStatusValues = ['draft', 'active', 'archived'] as const;

export function validateCreateTemplate(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // Required fields
  if (!isString(data.slug) || data.slug.length === 0 || data.slug.length > 100) {
    errors.push('slug: Must be a non-empty string between 1 and 100 characters');
  } else if (!/^[a-z0-9_-]+$/i.test(data.slug)) {
    errors.push('slug: Must be alphanumeric with dashes/underscores only');
  }
  if (!isString(data.name) || data.name.length === 0 || data.name.length > 200) {
    errors.push('name: Must be a non-empty string between 1 and 200 characters');
  }
  if (!isString(data.subject) || data.subject.length === 0 || data.subject.length > 500) {
    errors.push('subject: Must be a non-empty string between 1 and 500 characters');
  }

  // Optional fields
  if (data.description && (!isString(data.description) || data.description.length > 1000)) {
    errors.push('description: Max 1000 characters');
  }
  if (data.body_html && (!isString(data.body_html) || data.body_html.length > 100000)) {
    errors.push('body_html: Max 100000 characters');
  }
  if (data.body_text && (!isString(data.body_text) || data.body_text.length > 50000)) {
    errors.push('body_text: Max 50000 characters');
  }
  if (data.status && !templateStatusValues.includes(data.status as typeof templateStatusValues[number])) {
    errors.push('status: Must be one of: draft, active, archived');
  }

  return { valid: errors.length === 0, errors };
}

export function validateUpdateTemplate(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, errors: ['At least one field must be provided'] };
  }

  // Field validation
  if (data.name && (!isString(data.name) || data.name.length > 200)) {
    errors.push('name: Max 200 characters');
  }
  if (data.subject && (!isString(data.subject) || data.subject.length > 500)) {
    errors.push('subject: Max 500 characters');
  }
  if (data.body_html && (!isString(data.body_html) || data.body_html.length > 100000)) {
    errors.push('body_html: Max 100000 characters');
  }
  if (data.status && !templateStatusValues.includes(data.status as typeof templateStatusValues[number])) {
    errors.push('status: Must be one of: draft, active, archived');
  }

  return { valid: errors.length === 0, errors };
}

export function validateTemplateQuery(data: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  const validStatuses = ['all', 'draft', 'active', 'archived'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status: Must be one of: ${validStatuses.join(', ')}`);
  }

  const limit = parseInt(data.limit || '20', 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('limit: Must be between 1 and 100');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// ENROLLMENTS
// ============================================================================

export const enrollmentStatusValues = ['pending', 'active', 'paused', 'completed', 'cancelled', 'bounced'] as const;
export const variantValues = ['control', 'variant_a', 'variant_b', 'variant_c'] as const;

export function validateCreateEnrollment(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // Required: sequence_id
  if (!isString(data.sequence_id) || !isValidUUID(data.sequence_id)) {
    errors.push('sequence_id: Must be a valid UUID');
  }

  // At least one contact identifier
  const hasProspectId = isString(data.prospect_id) && data.prospect_id.length > 0;
  const hasContactId = isString(data.contact_id) && data.contact_id.length > 0;
  const hasExternalId = isString(data.external_lead_id) && data.external_lead_id.length > 0;

  if (!hasProspectId && !hasContactId && !hasExternalId) {
    errors.push('At least one of prospect_id, contact_id, or external_lead_id must be provided');
  }

  // Optional field validation
  if (data.assigned_variant && !variantValues.includes(data.assigned_variant as typeof variantValues[number])) {
    errors.push('assigned_variant: Must be one of: control, variant_a, variant_b, variant_c');
  }
  if (data.scheduled_for && isNaN(Date.parse(data.scheduled_for as string))) {
    errors.push('scheduled_for: Must be a valid ISO timestamp');
  }

  return { valid: errors.length === 0, errors };
}

export function validateBulkEnrollment(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  // Required: sequence_id
  if (!isString(data.sequence_id) || !isValidUUID(data.sequence_id)) {
    errors.push('sequence_id: Must be a valid UUID');
  }

  // Required: prospect_ids array
  if (!isArray(data.prospect_ids) || data.prospect_ids.length === 0) {
    errors.push('prospect_ids: Must be a non-empty array');
  } else if (data.prospect_ids.length > 100) {
    errors.push('prospect_ids: Maximum 100 prospects per bulk enrollment');
  }

  // Optional: assigned_variant
  if (data.assigned_variant && !variantValues.includes(data.assigned_variant as typeof variantValues[number])) {
    errors.push('assigned_variant: Must be one of: control, variant_a, variant_b, variant_c');
  }

  return { valid: errors.length === 0, errors };
}

export function validateEnrollmentQuery(data: Record<string, string>): ValidationResult {
  const errors: string[] = [];

  const validStatuses = ['all', 'pending', 'active', 'paused', 'completed', 'cancelled', 'bounced'];
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status: Must be one of: ${validStatuses.join(', ')}`);
  }

  const limit = parseInt(data.limit || '20', 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('limit: Must be between 1 and 100');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// PERSONALIZATION
// ============================================================================

export function validatePreviewContext(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(data)) {
    return { valid: false, errors: ['Context must be an object'] };
  }

  // All fields are optional
  const stringFields = ['first_name', 'last_name', 'company', 'title', 'industry', 'tech_stack'];
  for (const field of stringFields) {
    if (data[field] && !isString(data[field])) {
      errors.push(`${field}: Must be a string`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SequenceType = typeof sequenceTypeValues[number];
export type SequenceStatus = typeof sequenceStatusValues[number];
export type TemplateStatus = typeof templateStatusValues[number];
export type EnrollmentStatus = typeof enrollmentStatusValues[number];
export type VariantName = typeof variantValues[number];
