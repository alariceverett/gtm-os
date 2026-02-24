#!/usr/bin/env node
/**
 * Data Contract Verifier
 * Validates data integrity for GTM OS Supabase tables
 * 
 * Usage:
 *   node scripts/verify-data-contract.mjs                    # Run all checks
 *   node scripts/verify-data-contract.mjs --table=feedback   # Check specific table
 *   node scripts/verify-data-contract.mjs --evidence-only    # Only evidence_ref checks
 *   node scripts/verify-data-contract.mjs --format=json      # Output as JSON
 * 
 * Environment:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Service key for DB access
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Lazy import for Supabase - only loads when needed
let createClient = null;
async function loadSupabase() {
  if (!createClient) {
    const supabase = await import('@supabase/supabase-js');
    createClient = supabase.createClient;
  }
  return createClient;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const TABLES = {
  FEEDBACK_SIGNALS: 'feedback_signals',
  PREFERENCE_MODELS: 'preference_models',
  AUTONOMOUS_TASKS: 'autonomous_tasks'
};

const VIOLATION_TYPES = {
  MISSING_EVIDENCE_REF: 'missing_evidence_ref',
  REQUIRED_FIELD: 'required_field',
  INVALID_FORMAT: 'invalid_format',
  CONSTRAINT_VIOLATION: 'constraint_violation',
  MISSING_FOREIGN_KEY: 'broken_foreign_key'
};

const SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning'
};

// Fields that must exist and be non-null/empty
const REQUIRED_FIELDS = {
  feedback_signals: [
    'user_id',
    'content_type',
    'content_id', 
    'feedback_type',
    'created_at',
    'updated_at'
  ],
  preference_models: [
    'user_id',
    'communication_style',
    'notification_frequency',
    'autonomy_level',
    'timezone',
    'created_at',
    'updated_at'
  ],
  autonomous_tasks: [
    'user_id',
    'title',
    'task_type',
    'status',
    'source_agent',
    'risk_level',
    'approval_required',
    'priority',
    'created_at',
    'updated_at'
  ]
};

// Evidence ref requirements
const EVIDENCE_CONFIG = {
  feedback_signals: {
    required: false, // Optional but recommended
    requiredWhen: (record) => record.feedback_type === 'report' || record.feedback_type === 'thumbs_down',
    minFields: 1
  },
  autonomous_tasks: {
    required: true,
    requiredWhen: (record) => record.risk_level === 'high' || record.risk_level === 'critical',
    minFields: 1
  }
};

// Status values for KPI event validation
const KPI_EVENT_STATUSES = ['completed', 'failed', 'approved', 'rejected'];

// ============================================================================
// UTILITIES
// ============================================================================

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
  if (level !== 'json') {
    console.log(`${prefix} [${timestamp}] ${message}`);
  }
}

function createViolation(table, recordId, field, type, message, severity = SEVERITY.ERROR) {
  return {
    table,
    record_id: recordId,
    field,
    violation_type: type,
    message,
    severity,
    timestamp: new Date().toISOString()
  };
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

function hasEvidenceRef(value) {
  if (isEmpty(value)) return false;
  if (typeof value !== 'object') return false;
  // Must have at least one of these keys
  const evidenceKeys = ['event_id', 'metric_id', 'source_ref', 'external_links', 'attachments'];
  return evidenceKeys.some(key => value[key] !== undefined && value[key] !== null);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

class DataContractVerifier {
  constructor(supabase) {
    this.supabase = supabase;
    this.violations = [];
    this.stats = {
      checked: 0,
      passed: 0,
      failed: 0,
      byTable: {}
    };
  }

  async validateTable(tableName, options = {}) {
    const { limit = 1000, cursor = null, evidenceOnly = false, sampleOnly = false } = options;
    
    log(`Validating table: ${tableName}`, 'info');
    
    let query = this.supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (cursor) {
      query = query.gt('id', cursor);
    }

    if (sampleOnly) {
      // Get a random sample using offset
      const { count } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (count && count > limit) {
        const randomOffset = Math.floor(Math.random() * (count - limit));
        query = query.range(randomOffset, randomOffset + limit - 1);
      }
    }

    const { data: records, error } = await query;

    if (error) {
      log(`Error querying ${tableName}: ${error.message}`, 'error');
      return { error: error.message };
    }

    if (!records || records.length === 0) {
      log(`No records found in ${tableName}`, 'warn');
      return { checked: 0, violations: [] };
    }

    this.stats.byTable[tableName] = { checked: records.length, violations: 0 };
    
    for (const record of records) {
      this.stats.checked++;
      let recordHasViolation = false;

      // Check required fields
      if (!evidenceOnly) {
        const requiredFields = REQUIRED_FIELDS[tableName] || [];
        for (const field of requiredFields) {
          if (isEmpty(record[field])) {
            this.violations.push(createViolation(
              tableName,
              record.id,
              field,
              VIOLATION_TYPES.REQUIRED_FIELD,
              `Required field '${field}' is missing or empty`
            ));
            recordHasViolation = true;
          }
        }

        // Validate data types/formats
        recordHasViolation = await this.validateDataFormats(tableName, record) || recordHasViolation;
      }

      // Check evidence_ref (KPI events)
      const evidenceConfig = EVIDENCE_CONFIG[tableName];
      if (evidenceConfig) {
        const shouldHaveEvidence = evidenceConfig.requiredWhen 
          ? evidenceConfig.requiredWhen(record) 
          : evidenceConfig.required;

        if (shouldHaveEvidence) {
          if (!hasEvidenceRef(record.evidence_ref)) {
            this.violations.push(createViolation(
              tableName,
              record.id,
              'evidence_ref',
              VIOLATION_TYPES.MISSING_EVIDENCE_REF,
              `Record requires evidence_ref (risk_level=${record.risk_level}, feedback_type=${record.feedback_type})`
            ));
            recordHasViolation = true;
          }
        }
      }

      if (recordHasViolation) {
        this.stats.failed++;
        this.stats.byTable[tableName].violations++;
      } else {
        this.stats.passed++;
      }
    }

    log(`Checked ${records.length} records in ${tableName}`, 'success');
    return {
      checked: records.length,
      violations: this.violations.filter(v => v.table === tableName).length
    };
  }

  async validateDataFormats(tableName, record) {
    let hasViolation = false;

    // Table-specific validations
    switch (tableName) {
      case 'feedback_signals':
        // Validate rating is within range for star_rating
        if (record.feedback_type === 'star_rating') {
          if (!record.rating || record.rating < 1 || record.rating > 5) {
            this.violations.push(createViolation(
              tableName,
              record.id,
              'rating',
              VIOLATION_TYPES.CONSTRAINT_VIOLATION,
              `star_rating requires rating between 1-5, got ${record.rating}`
            ));
            hasViolation = true;
          }
        }
        break;

      case 'autonomous_tasks':
        // Validate priority range
        if (record.priority < 0 || record.priority > 100) {
          this.violations.push(createViolation(
            tableName,
            record.id,
            'priority',
            VIOLATION_TYPES.CONSTRAINT_VIOLATION,
            `Priority must be between 0-100, got ${record.priority}`
          ));
          hasViolation = true;
        }

        // Validate retry_count doesn't exceed max_retries
        if (record.retry_count > record.max_retries && record.max_retries > 0) {
          this.violations.push(createViolation(
            tableName,
            record.id,
            'retry_count',
            VIOLATION_TYPES.CONSTRAINT_VIOLATION,
            `retry_count (${record.retry_count}) exceeds max_retries (${record.max_retries})`
          ));
          hasViolation = true;
        }
        break;

      case 'preference_models':
        // Validate working hours format
        if (record.working_hours) {
          const wh = record.working_hours;
          if (wh.start && !/^\d{2}:\d{2}$/.test(wh.start)) {
            this.violations.push(createViolation(
              tableName,
              record.id,
              'working_hours.start',
              VIOLATION_TYPES.INVALID_FORMAT,
              `working_hours.start must be in HH:MM format, got ${wh.start}`
            ));
            hasViolation = true;
          }
        }
        break;
    }

    return hasViolation;
  }

  async runAllValidations(options = {}) {
    const { evidenceOnly = false, tables = Object.values(TABLES) } = options;
    
    log('=== Data Contract Verification Started ===', 'info');
    log(`Mode: ${evidenceOnly ? 'Evidence-only' : 'Full validation'}`, 'info');
    log(`Tables: ${tables.join(', ')}`, 'info');

    for (const tableName of tables) {
      await this.validateTable(tableName, { evidenceOnly });
    }

    return this.generateReport();
  }

  generateReport(format = 'text') {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total_checked: this.stats.checked,
        total_passed: this.stats.passed,
        total_failed: this.stats.failed,
        pass_rate: this.stats.checked > 0 ? ((this.stats.passed / this.stats.checked) * 100).toFixed(2) : 0
      },
      by_table: this.stats.byTable,
      violations: this.violations,
      severity_counts: {
        error: this.violations.filter(v => v.severity === SEVERITY.ERROR).length,
        warning: this.violations.filter(v => v.severity === SEVERITY.WARNING).length
      }
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // Text format
    let output = '\n' + '='.repeat(60) + '\n';
    output += 'DATA CONTRACT VERIFICATION REPORT\n';
    output += '='.repeat(60) + '\n\n';
    
    output += 'SUMMARY:\n';
    output += `  Records Checked: ${report.summary.total_checked}\n`;
    output += `  Passed: ${report.summary.total_passed}\n`;
    output += `  Failed: ${report.summary.total_failed}\n`;
    output += `  Pass Rate: ${report.summary.pass_rate}%\n`;
    output += `\n  Severity: ${report.severity_counts.error} errors, ${report.severity_counts.warning} warnings\n\n`;

    if (this.violations.length > 0) {
      output += 'VIOLATIONS:\n';
      output += '-'.repeat(60) + '\n';
      
      // Group by table
      const byTable = {};
      for (const v of this.violations) {
        if (!byTable[v.table]) byTable[v.table] = [];
        byTable[v.table].push(v);
      }

      for (const [table, violations] of Object.entries(byTable)) {
        output += `\n${table} (${violations.length}):\n`;
        for (const v of violations) {
          const emoji = v.severity === SEVERITY.ERROR ? '❌' : '⚠️';
          output += `  ${emoji} [${v.violation_type}] ${v.field}: ${v.message}\n`;
          output += `     Record: ${v.record_id || 'N/A'}\n`;
        }
      }
    } else {
      output += '✅ No violations found!\n';
    }

    output += '\n' + '='.repeat(60) + '\n';
    return output;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const options = {
    table: null,
    evidenceOnly: false,
    format: 'text',
    sampleOnly: false
  };

  for (const arg of args) {
    if (arg.startsWith('--table=')) {
      options.table = arg.split('=')[1];
    } else if (arg === '--evidence-only') {
      options.evidenceOnly = true;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg === '--sample') {
      options.sampleOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Data Contract Verifier

Usage: node verify-data-contract.mjs [options]

Options:
  --table=<name>      Validate specific table only
  --evidence-only     Only check evidence_ref on KPI events
  --format=json       Output as JSON instead of text
  --sample            Check a random sample instead of full scan
  --help, -h          Show this help message

Environment:
  SUPABASE_URL        Supabase project URL
  SUPABASE_SERVICE_KEY Supabase service role key
`);
      process.exit(0);
    }
  }

  // Check env vars
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log('Missing required environment variables:', 'error');
    log('  SUPABASE_URL - Your Supabase project URL', 'error');
    log('  SUPABASE_SERVICE_KEY - Your Supabase service role key', 'error');
    log('\nNote: Waiting for user to provide Supabase keys before executing.', 'warn');
    
    // Return a dry-run report showing what would be checked
    const verifier = new DataContractVerifier(null);
    const dryRunReport = {
      dry_run: true,
      message: 'Supabase keys not provided. This is a schema preview.',
      tables_to_check: Object.values(TABLES),
      validation_rules: {
        required_fields: REQUIRED_FIELDS,
        evidence_config: EVIDENCE_CONFIG,
        kpi_event_statuses: KPI_EVENT_STATUSES
      },
      cli_options: options,
      note: 'Run with SUPABASE_URL and SUPABASE_SERVICE_KEY set to execute actual validation.'
    };
    
    if (options.format === 'json') {
      console.log(JSON.stringify(dryRunReport, null, 2));
    } else {
      console.log('\n' + '='.repeat(60));
      console.log('DRY RUN - Schema Preview');
      console.log('='.repeat(60));
      console.log('\nTables to validate:');
      Object.values(TABLES).forEach(t => console.log(`  • ${t}`));
      console.log('\nRequired fields by table:');
      for (const [table, fields] of Object.entries(REQUIRED_FIELDS)) {
        console.log(`  ${table}:`);
        fields.forEach(f => console.log(`    - ${f}`));
      }
      console.log('\nEvidence ref requirements:');
      for (const [table, config] of Object.entries(EVIDENCE_CONFIG)) {
        console.log(`  ${table}: ${config.required ? 'Required' : 'Conditional'} (${config.requiredWhen ? 'rule-based' : 'always'})`);
      }
      console.log('\n' + '='.repeat(60));
      console.log('Provide SUPABASE_URL and SUPABASE_SERVICE_KEY to run live validation.');
    }
    process.exit(0);
  }

  // Create Supabase client
  const createClientFn = await loadSupabase();
  const supabase = createClientFn(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Run validation
  const verifier = new DataContractVerifier(supabase);
  
  const tables = options.table 
    ? [options.table] 
    : Object.values(TABLES);

  const report = await verifier.runAllValidations({
    evidenceOnly: options.evidenceOnly,
    tables
  });

  console.log(report);

  // Exit with error code if violations found
  const hasErrors = verifier.violations.some(v => v.severity === SEVERITY.ERROR);
  process.exit(hasErrors ? 1 : 0);
}

main().catch(err => {
  log(`Fatal error: ${err.message}`, 'error');
  console.error(err.stack);
  process.exit(2);
});
