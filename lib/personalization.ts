/**
 * Personalization Engine - Token Replacement System
 * 
 * Handles personalization tokens for email templates:
 * - Basic tokens: {{first_name}}, {{company}}, etc.
 * - Nested access: {{company.name}}
 * - Fallback values: {{first_name|there}}
 * - Conditional blocks: {{#if first_name}}...{{/if}}
 * - Date formatting: {{date_format}}
 * - HTML escaping for security
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ProspectData {
  first_name?: string;
  last_name?: string;
  company?: string | { name?: string };
  title?: string;
  industry?: string;
  tech_stack?: string;
  // Additional fields
  [key: string]: unknown;
}

export interface PersonalizationContext {
  prospect: ProspectData;
  days_since_research?: number;
  metadata?: Record<string, unknown>;
}

export interface PersonalizationOptions {
  /** Escape HTML in replaced values (default: true) */
  escapeHtml?: boolean;
  /** Skip missing tokens instead of leaving them (default: false) */
  removeMissing?: boolean;
  /** Date format for date tokens (default: 'MMMM d, yyyy') */
  dateFormat?: string;
  /** Custom fallback values for specific tokens */
  customDefaults?: Record<string, string>;
}

export interface TokenParseResult {
  raw: string;
  path: string;
  fallback?: string;
  isConditional: boolean;
  conditionalType?: 'if' | 'unless' | 'each';
  closeTag?: boolean;
}

export interface PersonalizationResult {
  text: string;
  replaced: string[];
  missing: string[];
  warnings: string[];
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_FALLBACKS: Record<string, string> = {
  first_name: 'there',
  last_name: 'friend',
  company: 'your company',
  title: 'professional',
  industry: 'your industry',
  tech_stack: 'your current stack',
  days_since_research: 'recently',
};

// ============================================================================
// ESCAPE UTILITIES
// ============================================================================

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

// ============================================================================
// TOKEN PARSING
// ============================================================================

const TOKEN_REGEX = /\{\{\s*([#\/?]?)([^}|\s]+)((?:\.[^}|\s]+)*)\s*(?:\|([^}]+))?\s*\}\}/g;
const CONDITIONAL_REGEX = /\{\{\s*(#if|#unless|#each|\/if|\/unless|\/each)\s+([^}]+)\s*\}\}/g;

/**
 * Extract all tokens from a template
 */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>();
  let match;

  // Regular tokens
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(template)) !== null) {
    const [, prefix, basePath, subPaths] = match;
    if (!prefix || prefix === '/') {
      const fullPath = basePath + (subPaths || '').replace(/\./g, '.');
      tokens.add(fullPath);
    }
  }

  return Array.from(tokens);
}

/**
 * Parse a token string into components
 */
export function parseToken(token: string): TokenParseResult {
  TOKEN_REGEX.lastIndex = 0;
  const match = TOKEN_REGEX.exec(`{{${token}}}`);
  
  if (!match) {
    return { raw: token, path: token, isConditional: false };
  }

  const [, prefix, basePath, subPaths, fallback] = match;
  const fullPath = basePath + (subPaths || '').replace(/\./g, '.');

  let conditionalType: 'if' | 'unless' | 'each' | undefined;
  let closeTag = false;

  if (prefix === '#') {
    if (basePath === 'if') conditionalType = 'if';
    else if (basePath === 'unless') conditionalType = 'unless';
  } else if (prefix === '/') {
    closeTag = true;
    if (basePath === 'if') conditionalType = 'if';
    else if (basePath === 'unless') conditionalType = 'unless';
  }

  return {
    raw: token,
    path: fullPath,
    fallback,
    isConditional: !!conditionalType || closeTag,
    conditionalType,
    closeTag,
  };
}

// ============================================================================
// VALUE RESOLUTION
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown, options: PersonalizationOptions = {}): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return options.escapeHtml !== false ? escapeHtml(value) : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    // Simple date formatting - could be enhanced with date-fns
    return value.toISOString().split('T')[0];
  }
  if (Array.isArray(value)) {
    return value.map(v => formatValue(v, options)).join(', ');
  }
  if (typeof value === 'object') {
    // For objects like { name: 'Acme' }, try to get a sensible display value
    const obj = value as Record<string, unknown>;
    if ('name' in obj) return String(obj.name || '');
    return JSON.stringify(value);
  }
  return String(value);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(date: Date, format: string): string {
  const replacements: Record<string, string> = {
    'yyyy': date.getFullYear().toString(),
    'yy': date.getFullYear().toString().slice(-2),
    'MMMM': MONTHS[date.getMonth()],
    'MMM': MONTHS[date.getMonth()].slice(0, 3),
    'MM': String(date.getMonth() + 1).padStart(2, '0'),
    'M': String(date.getMonth() + 1),
    'dd': String(date.getDate()).padStart(2, '0'),
    'd': String(date.getDate()),
    'EEEE': DAYS[date.getDay()],
    'EEE': DAYS[date.getDay()].slice(0, 3),
    'HH': String(date.getHours()).padStart(2, '0'),
    'H': String(date.getHours()),
    'mm': String(date.getMinutes()).padStart(2, '0'),
    'ss': String(date.getSeconds()).padStart(2, '0'),
  };

  return format.replace(/yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|mm|ss/g, match => replacements[match] || match);
}

// ============================================================================
// CONDITIONAL PROCESSING
// ============================================================================

interface ConditionalBlock {
  type: 'if' | 'unless';
  path: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Find conditional blocks in template
 */
function findConditionals(template: string): ConditionalBlock[] {
  const blocks: ConditionalBlock[] = [];
  const openRegex = /\{\{\s*#(if|unless)\s+([^}]+)\s*\}\}/g;
  const closeRegex = /\{\{\s*\/(if|unless)\s*\}\}/g;

  type Match = { index: number; type: 'open' | 'close'; tagType: 'if' | 'unless'; path?: string };
  const matches: Match[] = [];

  let match;
  while ((match = openRegex.exec(template)) !== null) {
    matches.push({
      index: match.index,
      type: 'open',
      tagType: match[1] as 'if' | 'unless',
      path: match[2].trim(),
    });
  }

  while ((match = closeRegex.exec(template)) !== null) {
    matches.push({
      index: match.index,
      type: 'close',
      tagType: match[1] as 'if' | 'unless',
      length: match[0].length,
    });
  }

  matches.sort((a, b) => a.index - b.index);

  // Match opening and closing tags
  const stack: Match[] = [];
  for (const m of matches) {
    if (m.type === 'open') {
      stack.push(m);
    } else if (m.type === 'close' && stack.length > 0) {
      const open = stack.pop();
      if (open && open.tagType === m.tagType) {
        const closeMatch = template.match(/\{\{\s*\/(if|unless)\s*\}\}/);
        if (closeMatch) {
          const endIndex = template.indexOf(closeMatch[0], open.index) + closeMatch[0].length;
          const fullMatch = template.slice(open.index, endIndex);
          const contentMatch = fullMatch.match(/\}\}([\s\S]*?)\{\{\s*\//);
          
          blocks.push({
            type: open.tagType,
            path: open.path || '',
            content: contentMatch ? contentMatch[1] : '',
            startIndex: open.index,
            endIndex,
          });
        }
      }
    }
  }

  return blocks;
}

/**
 * Process conditional blocks
 */
function processConditionals(
  template: string,
  context: PersonalizationContext,
  options: PersonalizationOptions
): { text: string; warnings: string[] } {
  let result = template;
  const warnings: string[] = [];

  // Process #if blocks
  const ifRegex = /\{\{\s*#if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/if\s*\}\}/g;
  result = result.replace(ifRegex, (match, path, content) => {
    const value = getNestedValue(context.prospect, path.trim());
    const hasValue = value !== undefined && value !== null && value !== '';
    
    if (hasValue) {
      return content;
    } else {
      return '';
    }
  });

  // Process #unless blocks (opposite of #if)
  const unlessRegex = /\{\{\s*#unless\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/unless\s*\}\}/g;
  result = result.replace(unlessRegex, (match, path, content) => {
    const value = getNestedValue(context.prospect, path.trim());
    const hasValue = value !== undefined && value !== null && value !== '';
    
    if (!hasValue) {
      return content;
    } else {
      return '';
    }
  });

  return { text: result, warnings };
}

// ============================================================================
// MAIN PERSONALIZATION FUNCTION
// ============================================================================

/**
 * Personalize a template with prospect data
 */
export function personalize(
  template: string,
  context: PersonalizationContext,
  options: PersonalizationOptions = {}
): PersonalizationResult {
  const replaced: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  // First process conditionals
  const conditionalResult = processConditionals(template, context, options);
  let text = conditionalResult.text;
  warnings.push(...conditionalResult.warnings);

  // Then process regular tokens
  TOKEN_REGEX.lastIndex = 0;
  const tokens = extractTokens(template);

  for (const tokenPath of tokens) {
    // Skip conditional tokens - already processed
    if (tokenPath.startsWith('#') || tokenPath.startsWith('/')) continue;

    const regex = new RegExp(`\\{\\{\\s*${tokenPath.replace(/\./g, '\\.?')}[^}]*\\|?([^}]*)\\s*\\}\\}`, 'g');
    
    // Get value from context
    let value: unknown;
    let fallback: string | undefined;

    // Parse the full token to get fallback
    const tokenMatch = template.match(new RegExp(`\\{\\{\\s*${tokenPath}\\s*(?:\\|([^}]+))?\\s*\\}\\}`));
    if (tokenMatch && tokenMatch[1]) {
      fallback = tokenMatch[1].trim();
    }

    // Special tokens
    if (tokenPath === 'days_since_research') {
      value = context.days_since_research;
    } else if (tokenPath === 'current_date') {
      value = formatDate(new Date(), options.dateFormat || 'MMMM d, yyyy');
    } else if (tokenPath === 'day_of_week') {
      value = DAYS[new Date().getDay()];
    } else {
      value = getNestedValue(context.prospect, tokenPath);
    }

    // Apply fallback
    if (value === undefined || value === null || value === '') {
      fallback = fallback || options.customDefaults?.[tokenPath] || DEFAULT_FALLBACKS[tokenPath];
      if (fallback !== undefined) {
        value = fallback;
        missing.push(tokenPath);
      } else {
        missing.push(tokenPath);
        value = options.removeMissing ? '' : `{{${tokenPath}}}`;
      }
    } else {
      replaced.push(tokenPath);
    }

    // Replace in text
    const fullRegex = new RegExp(`\\{\\{\\s*${tokenPath.replace(/\./g, '\\.')}\\s*(?:\\|[^}]+)?\\s*\\}\\}`, 'g');
    text = text.replace(fullRegex, formatValue(value, options));
  }

  return { text, replaced, missing, warnings };
}

/**
 * Personalize subject and body together
 */
export function personalizeEmail(
  subject: string,
  body: string,
  context: PersonalizationContext,
  options: PersonalizationOptions = {}
): { subject: string; body: string; tokens: string[]; missing: string[] } {
  const subjectResult = personalize(subject, context, options);
  const bodyResult = personalize(body, context, options);

  const allTokens = [...new Set([...extractTokens(subject), ...extractTokens(body)])];
  const allMissing = [...new Set([...subjectResult.missing, ...bodyResult.missing])];

  return {
    subject: subjectResult.text,
    body: bodyResult.text,
    tokens: allTokens,
    missing: allMissing,
  };
}

/**
 * Validate a template for required tokens
 */
export function validateTemplate(
  template: string,
  requiredFields: string[] = []
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tokens = extractTokens(template);

  for (const field of requiredFields) {
    if (!tokens.includes(field)) {
      errors.push(`Required field "${field}" not used in template`);
    }
  }

  // Check for unmatched conditional tags
  const openIf = (template.match(/\{\{\s*#if\s+/g) || []).length;
  const closeIf = (template.match(/\{\{\s*\/if\s*\}\}/g) || []).length;
  if (openIf !== closeIf) {
    errors.push(`Unmatched #if blocks: ${openIf} opened, ${closeIf} closed`);
  }

  const openUnless = (template.match(/\{\{\s*#unless\s+/g) || []).length;
  const closeUnless = (template.match(/\{\{\s*\/unless\s*\}\}/g) || []).length;
  if (openUnless !== closeUnless) {
    errors.push(`Unmatched #unless blocks: ${openUnless} opened, ${closeUnless} closed`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get preview data for a template
 */
export function getPreviewData(): ProspectData {
  return {
    first_name: 'Sarah',
    last_name: 'Johnson',
    company: { name: 'Acme Corporation' },
    title: 'Head of Engineering',
    industry: 'SaaS',
    tech_stack: 'React, Node.js, PostgreSQL',
  };
}

/**
 * Preview a template with sample data
 */
export function previewTemplate(
  subject: string,
  body: string,
  options: PersonalizationOptions = {}
): { subject: string; body: string; tokens: string[] } {
  const context: PersonalizationContext = {
    prospect: getPreviewData(),
    days_since_research: 2,
  };

  return {
    ...personalizeEmail(subject, body, context, options),
    tokens: extractTokens(subject + ' ' + body),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  personalize,
  personalizeEmail,
  extractTokens,
  validateTemplate,
  previewTemplate,
  getPreviewData,
  getNestedValue,
  parseToken,
};
