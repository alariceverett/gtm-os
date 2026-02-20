#!/usr/bin/env node
// Privacy Filter — strips ALL proprietary data from feedback payloads.
// Conservative: if in doubt, strip it.

'use strict';

// --- Allowlisted safe terms (structural/framework vocabulary only) ---
const SAFE_TERMS = new Set([
  // Forge file names
  'AGENTS.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'BOOTSTRAP.md',
  'HEARTBEAT.md', 'MEMORY.md', 'TOOLS.md', 'DECISION_FRAMEWORK.md',
  'EXCELLENCE_PREAMBLE.md', 'DELEGATION_SYSTEM.md', 'PRIORITY_SYSTEM.md',
  'CEO_OPERATING_RHYTHM.md', 'PRODUCT_PROCESS.md', 'SKILL_DISCOVERY.md',
  'WORK_QUEUE.md', 'TASK_BACKLOG.md', 'ORGANIZATIONAL_LEARNING.md',
  'IMPROVEMENT_ENGINE.md', 'SKILL_TREES.md', 'AFTER_ACTION_TEMPLATE.md',
  'WEEKLY_REVIEW_TEMPLATE.md', 'SKILL_PACK_TEMPLATE.md', 'AGENT_CURRICULUM.md',
  'TASK_TEMPLATE.md', 'SECURITY.md', 'SECURITY_CHECKLIST.md',
  'CREDENTIAL_AUDIT.sh', 'RLS_POLICIES.sql', 'FEEDBACK_AGENT.md',
  'PRIVACY_POLICY.md', 'COMPLETION_CHECKLIST.md',
  // Engine scripts
  'db.js', 'record_decision.js', 'record_delegation.js', 'record_step.js',
  'run_process.js', 'sync_priorities.js', 'lookback.js', 'evolve_prompt.js',
  'version_prompt.js', 'process_report.js', 'feedback_agent.js', 'privacy_filter.js',
  // Directories
  'org/', 'engine/', 'learning/', 'training/', 'templates/', 'security/',
  'feedback/', 'skills/', 'memory/', 'agents/',
  // Process/status terms
  'active', 'completed', 'pending', 'running', 'queued', 'blocked',
  'ceo_autonomous', 'board_required', 'moderate', 'reversible', 'irreversible',
  // Error type categories
  'ENOENT', 'ECONNREFUSED', 'EACCES', 'EPERM', 'TIMEOUT', 'ENOTFOUND',
  'SyntaxError', 'TypeError', 'ReferenceError', 'RangeError',
  'CONNECTION_REFUSED', 'QUERY_FAILED', 'PARSE_ERROR',
  // Skill gap categories (generic)
  'frontend', 'backend', 'design', 'devops', 'marketing', 'analytics',
  'copywriting', 'seo', 'deployment', 'testing', 'security', 'infrastructure',
  'product', 'growth', 'operations', 'data', 'automation',
  // Generic structural words
  'process', 'decision', 'delegation', 'step', 'priority', 'skill',
  'agent', 'run', 'rating', 'quality', 'review',
]);

// --- Patterns to strip ---
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s"')\]>]+/gi;
const IP_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g;
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
const QUOTED_RE = /"[^"]{2,}"|'[^']{2,}'/g;
const CREDENTIAL_RE = /\b(sk-|pk-|ghp_|gho_|github_pat_|xoxb-|xoxp-|Bearer\s+)[A-Za-z0-9_-]+/gi;
const CONNECTION_STRING_RE = /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^\s]+/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Numbers above 10 (but keep single digits & 10, and common structural numbers)
const LARGE_NUMBER_RE = /\b(?!10\b)\d{2,}\b/g;

/**
 * Scrub a string of all potentially proprietary information.
 * @param {string} text - Raw text to sanitize
 * @returns {string} - Sanitized text safe for public posting
 */
function scrub(text) {
  if (!text || typeof text !== 'string') return '';

  let result = text;

  // Strip credentials and connection strings first
  result = result.replace(CREDENTIAL_RE, '[REDACTED_CREDENTIAL]');
  result = result.replace(CONNECTION_STRING_RE, '[REDACTED_CONNECTION]');

  // Strip emails
  result = result.replace(EMAIL_RE, '[REDACTED_EMAIL]');

  // Strip URLs (but preserve safe Forge-related paths)
  result = result.replace(URL_RE, (match) => {
    if (match.includes('github.com/EJKIV/Forge')) return match;
    return '[REDACTED_URL]';
  });

  // Strip IPs
  result = result.replace(IP_RE, '[REDACTED_IP]');

  // Strip phone numbers
  result = result.replace(PHONE_RE, (match) => {
    // Avoid false positives on short numbers or version-like strings
    if (match.replace(/\D/g, '').length < 7) return match;
    return '[REDACTED_PHONE]';
  });

  // Strip UUIDs (replace with generic placeholder)
  result = result.replace(UUID_RE, '[ID]');

  // Strip quoted strings (likely proprietary content)
  result = result.replace(QUOTED_RE, (match) => {
    const inner = match.slice(1, -1);
    // Allow if it's a safe term
    if (SAFE_TERMS.has(inner)) return match;
    return '[REDACTED_CONTENT]';
  });

  // Strip large numbers (keep ratios expressed as decimals like 0.75)
  result = result.replace(LARGE_NUMBER_RE, (match, offset) => {
    const num = parseInt(match, 10);
    // Keep numbers 0-10
    if (num <= 10) return match;
    // Keep if preceded by a dot (decimal like 0.75 or rating like 4.2)
    if (offset > 0 && result[offset - 1] === '.') return match;
    // Bucket large numbers into ranges
    if (num <= 50) return '[10-50]';
    if (num <= 100) return '[50-100]';
    if (num <= 500) return '[100-500]';
    return '[500+]';
  });

  return result;
}

/**
 * Scrub an entire object recursively.
 * @param {*} obj - Object, array, or primitive to sanitize
 * @returns {*} - Sanitized copy
 */
function scrubObject(obj) {
  if (typeof obj === 'string') return scrub(obj);
  if (Array.isArray(obj)) return obj.map(scrubObject);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      // Strip keys that look sensitive
      const lk = key.toLowerCase();
      if (['password', 'secret', 'token', 'credential', 'api_key', 'apikey',
           'authorization', 'cookie', 'session'].includes(lk)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = scrubObject(value);
      }
    }
    return result;
  }
  // Numbers: bucket if large
  if (typeof obj === 'number' && obj > 10) {
    // Keep as-is for counts/ratios in structured data — the scrub() on strings handles display
    return obj;
  }
  return obj;
}

/**
 * Validate that scrubbed text contains no obviously unsafe patterns.
 * Returns { safe: boolean, issues: string[] }
 */
function validate(text) {
  const issues = [];
  if (EMAIL_RE.test(text)) issues.push('Contains email address');
  if (CREDENTIAL_RE.test(text)) issues.push('Contains credential pattern');
  if (CONNECTION_STRING_RE.test(text)) issues.push('Contains connection string');
  // Reset lastIndex for global regexes
  EMAIL_RE.lastIndex = 0;
  CREDENTIAL_RE.lastIndex = 0;
  CONNECTION_STRING_RE.lastIndex = 0;
  return { safe: issues.length === 0, issues };
}

module.exports = { scrub, scrubObject, validate, SAFE_TERMS };
