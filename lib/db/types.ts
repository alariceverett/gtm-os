/**
 * Database Types for GTM OS Supabase Integration
 * Generated: 2026-02-24
 * 
 * These types map directly to database tables defined in migrations/
 */

// ============================================================================
// ENUM DEFINITIONS
// ============================================================================

/** Feedback type values */
export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'star_rating' | 'comment' | 'report';

/** Content categories that can receive feedback */
export type FeedbackContentType = 'message' | 'task_output' | 'decision_draft' | 'report' | 'suggestion';

/** Feedback category for reporting issues */
export type FeedbackCategory = 'accuracy' | 'tone' | 'helpfulness' | 'speed' | 'other';

/** Communication style preferences */
export type CommunicationStyle = 'concise' | 'balanced' | 'detailed';

/** Notification frequency settings */
export type NotificationFrequency = 'realtime' | 'hourly_digest' | 'as_needed' | 'daily_summary';

/** Output format preferences */
export type OutputFormat = 'bullet_points' | 'structured' | 'narrative' | 'visual';

/** Detail level preferences */
export type DetailLevel = 'minimal' | 'standard' | 'comprehensive';

/** Autonomy level for AI actions */
export type AutonomyLevel = 'notify_only' | 'suggest' | 'auto_with_review' | 'full_auto';

/** UI theme preferences */
export type Theme = 'light' | 'dark' | 'system';

/** UI density preferences */
export type UIDensity = 'compact' | 'comfortable' | 'spacious';

/** Task types for autonomous tasks */
export type TaskType = 'suggestion' | 'auto_action' | 'review_required' | 'scheduled';

/** Status workflow for autonomous tasks */
export type TaskStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'cancelled';

/** Risk levels for task assessment */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Action types for auto-execution */
export type ActionType = 'http_request' | 'db_operation' | 'file_operation' | 'message_send' | 'task_create' | 'custom';

// ============================================================================
// TABLE ROW TYPES
// ============================================================================

/** Schema for evidence_ref JSONB field */
export interface EvidenceRef {
  event_id?: string;
  metric_id?: string;
  source_ref?: string;
  external_links?: string[];
  attachments?: string[];
  [key: string]: unknown;
}

/** Schema for context JSONB field */
export interface FeedbackContext {
  page?: string;
  workflow_id?: string;
  session_context?: Record<string, unknown>;
  device_info?: Record<string, unknown>;
  [key: string]: unknown;
}

/** feedback_signals table row */
export interface FeedbackSignalRow {
  id: string;
  user_id: string;
  session_id?: string;
  content_type: FeedbackContentType;
  content_id: string;
  agent_id?: string;
  feedback_type: FeedbackType;
  rating?: number;
  comment?: string;
  category?: FeedbackCategory;
  evidence_ref: EvidenceRef;
  context: FeedbackContext;
  tags: string[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

/** Insert type for feedback_signals */
export type FeedbackSignalInsert = Omit<FeedbackSignalRow, 'id' | 'created_at' | 'updated_at' | 'resolved_at'>;

/** Update type for feedback_signals */
export type FeedbackSignalUpdate = Partial<Omit<FeedbackSignalRow, 'id' | 'created_at' | 'user_id'>>;

/** Schema for working_hours JSONB in preferences */
export interface WorkingHours {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  days: number[]; // 0-6, where 0 is Sunday
}

/** Schema for learned_patterns JSONB in preferences */
export interface LearnedPatterns {
  preferred_content_types?: string[];
  avoidance_patterns?: string[];
  peak_activity_times?: string[];
  [key: string]: unknown;
}

/** preference_models table row */
export interface PreferenceModelRow {
  id: string;
  user_id: string;
  communication_style: CommunicationStyle;
  notification_frequency: NotificationFrequency;
  preferred_channels: string[];
  preferred_output_format: OutputFormat;
  detail_level: DetailLevel;
  autonomy_level: AutonomyLevel;
  confirmation_required_for: string[];
  interests: Record<string, unknown>;
  timezone: string;
  working_hours: WorkingHours;
  preferred_meeting_times: unknown[];
  theme: Theme;
  density: UIDensity;
  language: string;
  learned_patterns: LearnedPatterns;
  version: number;
  created_at: string;
  updated_at: string;
}

/** Insert type for preference_models */
export type PreferenceModelInsert = Omit<PreferenceModelRow, 'id' | 'version' | 'created_at' | 'updated_at'>;

/** Update type for preference_models */
export type PreferenceModelUpdate = Partial<Omit<PreferenceModelRow, 'id' | 'user_id' | 'version' | 'created_at'>>;

/** Schema for source_context JSONB in autonomous_tasks */
export interface TaskSourceContext {
  workflow_id?: string;
  trigger_event_id?: string;
  related_entity_ids?: string[];
  reasoning?: string;
  [key: string]: unknown;
}

/** Schema for action_config JSONB in autonomous_tasks */
export interface ActionConfig {
  endpoint?: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
  service?: string;
  [key: string]: unknown;
}

/** Schema for execution_result JSONB in autonomous_tasks */
export interface ExecutionResult {
  success: boolean;
  output?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  [key: string]: unknown;
}

/** autonomous_tasks table row */
export interface AutonomousTaskRow {
  id: string;
  user_id: string;
  assigned_to?: string;
  title: string;
  description?: string;
  task_type: TaskType;
  priority: number;
  status: TaskStatus;
  source_agent: string;
  source_context: TaskSourceContext;
  trigger_event?: string;
  evidence_ref: EvidenceRef;
  expected_outcome?: string;
  risk_level: RiskLevel;
  action_type?: ActionType;
  action_config?: ActionConfig;
  scheduled_for?: string;
  executed_at?: string;
  execution_result?: ExecutionResult;
  execution_error?: string;
  retry_count: number;
  max_retries: number;
  approval_required: boolean;
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  parent_task_id?: string;
  related_decision_id?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  completed_at?: string;
}

/** Insert type for autonomous_tasks */
export type AutonomousTaskInsert = Omit<AutonomousTaskRow, 'id' | 'created_at' | 'updated_at' | 'executed_at' | 'completed_at' | 'retry_count'>;

/** Update type for autonomous_tasks */
export type AutonomousTaskUpdate = Partial<Omit<AutonomousTaskRow, 'id' | 'user_id' | 'created_at'>>;

// ============================================================================
// DATABASE RESPONSE TYPES (Supabase style)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      feedback_signals: {
        Row: FeedbackSignalRow;
        Insert: FeedbackSignalInsert;
        Update: FeedbackSignalUpdate;
      };
      preference_models: {
        Row: PreferenceModelRow;
        Insert: PreferenceModelInsert;
        Update: PreferenceModelUpdate;
      };
      autonomous_tasks: {
        Row: AutonomousTaskRow;
        Insert: AutonomousTaskInsert;
        Update: AutonomousTaskUpdate;
      };
    };
    Views: {
      pending_autonomous_tasks: {
        Row: AutonomousTaskRow;
      };
    };
    Enums: {
      feedback_type: FeedbackType;
      communication_style: CommunicationStyle;
      notification_frequency: NotificationFrequency;
      autonomy_level: AutonomyLevel;
      task_type: TaskType;
      task_status: TaskStatus;
      risk_level: RiskLevel;
      action_type: ActionType;
    };
  };
}

// ============================================================================
// HELPER TYPES FOR DATA CONTRACT VALIDATION
// ============================================================================

/** Validation result from data contract checks */
export interface ValidationResult {
  isValid: boolean;
  violations: DataViolation[];
  checked: number;
  passed: number;
  failed: number;
}

/** Data contract violation record */
export interface DataViolation {
  table: string;
  record_id?: string;
  field: string;
  violation_type: 'missing_evidence_ref' | 'required_field' | 'invalid_format' | 'constraint_violation' | 'broken_foreign_key';
  message: string;
  severity: 'error' | 'warning';
}

/** KPI Events that require evidence_ref validation */
export type KPIEventType = 
  | 'task_created'
  | 'task_completed'
  | 'decision_made'
  | 'feedback_received'
  | 'preference_updated'
  | 'autonomous_action_executed';

/** Evidence ref requirement by table and context */
export const EVIDENCE_REQUIRED_TABLES: Array<{ table: string; fields: string[]; condition?: string }> = [
  { table: 'feedback_signals', fields: ['content_id', 'feedback_type'] },
  { table: 'autonomous_tasks', fields: ['task_type', 'source_agent', 'evidence_ref'], condition: 'risk_level IN (high, critical)' },
];

/** Required fields by table for validation */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  feedback_signals: ['user_id', 'content_type', 'content_id', 'feedback_type', 'created_at'],
  preference_models: ['user_id', 'communication_style', 'notification_frequency', 'autonomy_level', 'timezone'],
  autonomous_tasks: ['user_id', 'title', 'task_type', 'status', 'source_agent', 'risk_level'],
};
