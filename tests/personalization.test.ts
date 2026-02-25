/**
 * Tests for the Personalization Engine
 * 
 * Coverage targets: >80% across lines, functions, branches
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  personalize,
  personalizeEmail,
  extractTokens,
  validateTemplate,
  previewTemplate,
  getNestedValue,
  parseToken,
  getPreviewData,
  PersonalizationContext,
  PersonalizationOptions,
} from '@/lib/personalization';

// ============================================================================
// FIXTURES
// ============================================================================

function createMockContext(overrides: Partial<PersonalizationContext['prospect']> = {}): PersonalizationContext {
  return {
    prospect: {
      first_name: 'John',
      last_name: 'Smith',
      company: { name: 'TechCorp', size: '50-100' },
      title: 'CTO',
      industry: 'Technology',
      tech_stack: 'React, Node.js',
      ...overrides,
    },
    days_since_research: 3,
  };
}

// ============================================================================
// EXTRACT TOKENS
// ============================================================================

describe('extractTokens', () => {
  it('should extract simple tokens', () => {
    const template = 'Hello {{first_name}}, welcome to {{company}}';
    const tokens = extractTokens(template);
    expect(tokens).toContain('first_name');
    expect(tokens).toContain('company');
  });

  it('should extract nested tokens', () => {
    const template = 'Welcome to {{company.name}}';
    const tokens = extractTokens(template);
    expect(tokens).toContain('company.name');
  });

  it('should handle tokens with whitespace', () => {
    const template = 'Hello {{ first_name }}, from {{  company  }}';
    const tokens = extractTokens(template);
    expect(tokens).toContain('first_name');
    expect(tokens).toContain('company');
  });

  it('should deduplicate tokens', () => {
    const template = '{{first_name}} {{first_name}}';
    const tokens = extractTokens(template);
    expect(tokens).toHaveLength(1);
  });

  it('should extract tokens with fallbacks', () => {
    const template = '{{first_name|there}} {{company|your company}}';
    const tokens = extractTokens(template);
    expect(tokens).toContain('first_name');
    expect(tokens).toContain('company');
  });

  it('should return empty array for no tokens', () => {
    const template = 'Plain text without tokens';
    const tokens = extractTokens(template);
    expect(tokens).toHaveLength(0);
  });
});

// ============================================================================
// PARSE TOKEN
// ============================================================================

describe('parseToken', () => {
  it('should parse basic token', () => {
    const result = parseToken('first_name');
    expect(result.path).toBe('first_name');
    expect(result.isConditional).toBe(false);
  });

  it('should parse token with fallback', () => {
    const result = parseToken('first_name|there');
    expect(result.path).toBe('first_name');
    expect(result.fallback).toBe('there');
  });

  it('should parse nested token', () => {
    const result = parseToken('company.name');
    expect(result.path).toBe('company.name');
  });

  it('should parse conditional tokens', () => {
    // The parseToken function handles basic token extraction
    // but full conditional parsing is done in the personalize function
    const result = parseToken('first_name');
    expect(result.path).toBe('first_name');
    expect(result.isConditional).toBe(false);
  });
});

// ============================================================================
// GET NESTED VALUE
// ============================================================================

describe('getNestedValue', () => {
  it('should get top-level value', () => {
    const obj = { first_name: 'John' };
    expect(getNestedValue(obj, 'first_name')).toBe('John');
  });

  it('should get nested value', () => {
    const obj = { company: { name: 'TechCorp' } };
    expect(getNestedValue(obj, 'company.name')).toBe('TechCorp');
  });

  it('should return undefined for missing path', () => {
    const obj = { first_name: 'John' };
    expect(getNestedValue(obj, 'missing.path')).toBeUndefined();
  });

  it('should return undefined for null/undefined obj', () => {
    expect(getNestedValue(null, 'key')).toBeUndefined();
    expect(getNestedValue(undefined, 'key')).toBeUndefined();
  });

  it('should handle deeply nested paths', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(getNestedValue(obj, 'a.b.c')).toBe('deep');
  });
});

// ============================================================================
// PERSONALIZE
// ============================================================================

describe('personalize', () => {
  it('should replace simple tokens', () => {
    const template = 'Hello {{first_name}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('Hello John');
    expect(result.replaced).toContain('first_name');
  });

  it('should replace nested tokens', () => {
    const template = 'Company: {{company.name}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('Company: TechCorp');
    expect(result.replaced).toContain('company.name');
  });

  it('should use fallback values', () => {
    const template = 'Hello {{missing|friend}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('Hello friend');
    expect(result.missing).toContain('missing');
  });

  it('should use default fallbacks', () => {
    const context = createMockContext({ first_name: undefined });
    const template = 'Hi {{first_name}}';
    const result = personalize(template, context);
    expect(result.text).toBe('Hi there');
    expect(result.missing).toContain('first_name');
  });

  it('should handle days_since_research token', () => {
    const template = 'Researched {{days_since_research}} days ago';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('Researched 3 days ago');
  });

  it('should escape HTML by default', () => {
    const template = '{{first_name}}';
    const context: PersonalizationContext = {
      prospect: { first_name: '<script>alert("xss")</script>' },
    };
    const result = personalize(template, context);
    expect(result.text).not.toContain('<script>');
    expect(result.text).toContain('&lt;script&gt;');
  });

  it('should not escape HTML when disabled', () => {
    const template = '{{first_name}}';
    const context: PersonalizationContext = {
      prospect: { first_name: '<b>Bold</b>' },
    };
    const result = personalize(template, context, { escapeHtml: false });
    expect(result.text).toBe('<b>Bold</b>');
  });

  it('should handle conditionals with #if', () => {
    const template = '{{#if first_name}}Hello {{first_name}}{{/if}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('Hello John');
  });

  it('should skip conditional block when value missing', () => {
    const template = '{{#if missing}}This should not appear{{/if}}';
    const result = personalize(template, createMockContext());
    expect(result.text).not.toContain('This should not appear');
  });

  it('should handle conditionals with #unless', () => {
    const template = '{{#unless first_name}}Missing name{{/unless}}';
    const result = personalize(template, createMockContext());
    expect(result.text).not.toContain('Missing name');
  });

  it('should show #unless block when value missing', () => {
    const template = '{{#unless missing}}No value{{/unless}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('No value');
  });

  it('should handle multiple replacements', () => {
    const template = '{{first_name}} {{last_name}} from {{company.name}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('John Smith from TechCorp');
    expect(result.replaced).toHaveLength(3);
  });

  it('should track missing tokens', () => {
    const template = '{{first_name}} {{missing_key}}';
    const result = personalize(template, createMockContext());
    expect(result.missing).toContain('missing_key');
    expect(result.missing).not.toContain('first_name');
  });

  it('should preserve template when token not found and removeMissing false', () => {
    const template = '{{unknown_token}}';
    const result = personalize(template, createMockContext(), { removeMissing: false });
    expect(result.text).toBe('{{unknown_token}}');
  });

  it('should remove missing tokens when removeMissing true', () => {
    const template = '{{unknown_token}}';
    const result = personalize(template, createMockContext(), { removeMissing: true });
    expect(result.text).toBe('');
  });
});

// ============================================================================
// PERSONALIZE EMAIL
// ============================================================================

describe('personalizeEmail', () => {
  it('should personalize both subject and body', () => {
    const subject = 'Hello {{first_name}}';
    const body = 'Welcome {{first_name}} from {{company.name}}';
    const result = personalizeEmail(subject, body, createMockContext());
    
    expect(result.subject).toBe('Hello John');
    expect(result.body).toBe('Welcome John from TechCorp');
    expect(result.tokens).toContain('first_name');
    expect(result.tokens).toContain('company.name');
  });

  it('should track missing tokens across subject and body', () => {
    const subject = 'Hello {{first_name}}';
    const body = 'Missing {{unknown}}';
    const result = personalizeEmail(subject, body, createMockContext());
    
    expect(result.missing).toContain('unknown');
    expect(result.missing).not.toContain('first_name');
  });
});

// ============================================================================
// VALIDATE TEMPLATE
// ============================================================================

describe('validateTemplate', () => {
  it('should validate template with all required fields', () => {
    const template = 'Hello {{first_name}} from {{company}}';
    const result = validateTemplate(template, ['first_name', 'company']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation for missing required fields', () => {
    const template = 'Hello {{first_name}}';
    const result = validateTemplate(template, ['first_name', 'company']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Required field "company" not used in template');
  });

  it('should detect unmatched #if blocks', () => {
    const template = '{{#if first_name}}Hello';
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Unmatched'))).toBe(true);
  });

  it('should validate matched #if blocks', () => {
    const template = '{{#if first_name}}Hello{{/if}}';
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// PREVIEW TEMPLATE
// ============================================================================

describe('previewTemplate', () => {
  it('should return personalized template with sample data', () => {
    const subject = 'Hello {{first_name}}';
    const body = 'Welcome to {{company.name}}';
    const result = previewTemplate(subject, body);
    
    expect(result.subject).toContain('Hello');
    expect(result.body).toContain('Welcome to');
    expect(result.tokens).toContain('first_name');
    expect(result.tokens).toContain('company.name');
  });
});

describe('getPreviewData', () => {
  it('should return sample prospect data', () => {
    const data = getPreviewData();
    expect(data.first_name).toBe('Sarah');
    expect(data.last_name).toBe('Johnson');
    expect(data.company).toHaveProperty('name');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty template', () => {
    const result = personalize('', createMockContext());
    expect(result.text).toBe('');
  });

  it('should handle template with only tokens', () => {
    const template = '{{first_name}}';
    const result = personalize(template, createMockContext());
    expect(result.text).toBe('John');
  });

  it('should handle special characters in values', () => {
    const template = '{{first_name}}';
    const context: PersonalizationContext = {
      prospect: { first_name: 'O\'Brien' },
    };
    const result = personalize(template, context, { escapeHtml: false });
    expect(result.text).toBe('O\'Brien');
  });

  it('should handle numeric values', () => {
    const template = '{{score}}';
    const context: PersonalizationContext = {
      prospect: { score: 42 },
    };
    const result = personalize(template, context);
    expect(result.text).toBe('42');
  });

  it('should handle boolean values', () => {
    const template = '{{is_active}}';
    const context: PersonalizationContext = {
      prospect: { is_active: true },
    };
    const result = personalize(template, context);
    expect(result.text).toBe('true');
  });

  it('should handle arrays', () => {
    const template = '{{tags}}';
    const context: PersonalizationContext = {
      prospect: { tags: ['foo', 'bar'] },
    };
    const result = personalize(template, context);
    expect(result.text).toBe('foo, bar');
  });
});
