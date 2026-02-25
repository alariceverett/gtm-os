/**
 * Tests for Validation Module
 * 
 * Tests for validation functions used in API endpoints
 */

import { describe, it, expect } from 'vitest';
import {
  isValidUUID,
  validateCreateSequence,
  validateUpdateSequence,
  validateSequenceQuery,
  validateCreateTemplate,
  validateUpdateTemplate,
  validateTemplateQuery,
  validateCreateEnrollment,
  validateBulkEnrollment,
} from '@/lib/validation';

describe('isValidUUID', () => {
  it('should validate valid UUID', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true); // uppercase
  });

  it('should reject invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // too short
    expect(isValidUUID('550e8400-e29b-41d4-a716-44665544000g')).toBe(false); // invalid char
    expect(isValidUUID('uuid')).toBe(false);
    expect(isValidUUID('123-456')).toBe(false);
  });
});

describe('validateCreateSequence', () => {
  it('should validate valid sequence', () => {
    const result = validateCreateSequence({
      slug: 'test-sequence',
      name: 'Test Sequence',
      sequence_type: 'cold_outreach',
      steps: [
        { step_number: 0, wait_days: 0, send_window_start: '09:00', send_window_end: '17:00' },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject non-object', () => {
    const result = validateCreateSequence(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Request body must be an object');
  });

  it('should reject missing slug', () => {
    const result = validateCreateSequence({
      name: 'Test',
      steps: [{ step_number: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('slug'))).toBe(true);
  });

  it('should reject missing name', () => {
    const result = validateCreateSequence({
      slug: 'test',
      steps: [{ step_number: 0 }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('should reject missing steps', () => {
    const result = validateCreateSequence({
      slug: 'test',
      name: 'Test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('steps'))).toBe(true);
  });

  it('should reject empty steps array', () => {
    const result = validateCreateSequence({
      slug: 'test',
      name: 'Test',
      steps: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('steps'))).toBe(true);
  });
});

describe('validateUpdateSequence', () => {
  it('should validate valid update', () => {
    const result = validateUpdateSequence({ name: 'Updated Name' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty updates', () => {
    const result = validateUpdateSequence({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one field must be provided');
  });

  it('should validate sequence_type', () => {
    const result = validateUpdateSequence({ sequence_type: 'invalid_type' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sequence_type'))).toBe(true);
  });
});

describe('validateSequenceQuery', () => {
  it('should validate query parameters', () => {
    const result = validateSequenceQuery({ status: 'active', limit: '20', offset: '0' });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = validateSequenceQuery({ status: 'deleted' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('status'))).toBe(true);
  });

  it('should reject invalid limit', () => {
    const result = validateSequenceQuery({ limit: '101' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('limit'))).toBe(true);
  });

  it('should reject negative offset', () => {
    const result = validateSequenceQuery({ offset: '-1' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('offset'))).toBe(true);
  });
});

describe('validateCreateTemplate', () => {
  it('should validate valid template', () => {
    const result = validateCreateTemplate({
      slug: 'welcome-email',
      name: 'Welcome Email',
      subject: 'Welcome {{first_name}}!',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid slug format', () => {
    const result = validateCreateTemplate({
      slug: 'invalid slug!', // space and !
      name: 'Test',
      subject: 'Subject',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('slug'))).toBe(true);
  });

  it('should require subject', () => {
    const result = validateCreateTemplate({
      slug: 'test',
      name: 'Test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('subject'))).toBe(true);
  });
});

describe('validateCreateEnrollment', () => {
  it('should validate valid enrollment', () => {
    const result = validateCreateEnrollment({
      sequence_id: '550e8400-e29b-41d4-a716-446655440000',
      prospect_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.valid).toBe(true);
  });

  it('should require at least one contact identifier', () => {
    const result = validateCreateEnrollment({
      sequence_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('At least one'))).toBe(true);
  });

  it('should validate UUID format', () => {
    const result = validateCreateEnrollment({
      sequence_id: 'not-a-uuid',
      prospect_id: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sequence_id'))).toBe(true);
  });
});

describe('validateBulkEnrollment', () => {
  it('should validate valid bulk enrollment', () => {
    const result = validateBulkEnrollment({
      sequence_id: '550e8400-e29b-41d4-a716-446655440000',
      prospect_ids: ['550e8400-e29b-41d4-a716-446655440001'],
    });
    expect(result.valid).toBe(true);
  });

  it('should reject empty prospect_ids', () => {
    const result = validateBulkEnrollment({
      sequence_id: '550e8400-e29b-41d4-a716-446655440000',
      prospect_ids: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('prospect_ids'))).toBe(true);
  });

  it('should reject too many prospects', () => {
    const prospect_ids = Array(101).fill('550e8400-e29b-41d4-a716-446655440001');
    const result = validateBulkEnrollment({
      sequence_id: '550e8400-e29b-41d4-a716-446655440000',
      prospect_ids,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('100'))).toBe(true);
  });
});
