/**
 * Research Job Queue
 * Async job processing for prospect discovery and data tasks
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type JobType = 
  | 'prospect_search'
  | 'company_enrichment'
  | 'bulk_import'
  | 'signal_detection'
  | 'list_building'
  | 'data_cleansing'
  | 'competitor_research';

export type JobStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchJob {
  id: string;
  name: string;
  description?: string;
  type: JobType;
  status: JobStatus;
  
  // Search configuration
  searchParams: {
    filters?: {
      industries?: string[];
      companySize?: string[];
      jobTitles?: string[];
      technologies?: string[];
      fundingStage?: string[];
      signalTypes?: string[];
      locations?: string[];
      excludeCompanies?: string[];
    };
    limit?: number;
    sortBy?: string;
    sources?: string[];
  };
  
  // Progress tracking
  progressPercentage: number;
  totalRecords: number;
  processedRecords: number;
  successCount: number;
  errorCount: number;
  skipCount: number;
  
  // Results
  resultSummary?: {
    prospectsCreated?: number;
    companiesFound?: number;
    averageQualityScore?: string;
    topIndustries?: Record<string, number>;
    signalsDetected?: Record<string, number>;
    enrichmentRate?: number;
  };
  
  // Error handling
  lastError?: string;
  errorDetails?: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  
  // Timing
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Ownership
  createdBy: string;
  organizationId?: string;
  
  // Campaign assignment
  assignToCampaignId?: string;
  assignToUserId?: string;
  tags?: string[];
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  percentage: number;
  processed: number;
  total: number;
  message?: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface JobQueueConfig {
  supabase: SupabaseClient;
  maxConcurrentJobs?: number;
  pollIntervalMs?: number;
  defaultMaxRetries?: number;
}

export interface JobProcessor {
  (job: ResearchJob, updateProgress: (progress: JobProgress) => void): Promise<boolean>;
}

export interface JobProcessorRegistry {
  [jobType: string]: JobProcessor;
}

export class ResearchJobQueue {
  private supabase: SupabaseClient;
  private maxConcurrentJobs: number;
  private pollIntervalMs: number;
  private defaultMaxRetries: number;
  private processors: JobProcessorRegistry = {};
  private runningJobs: Map<string, AbortController> = new Map();
  private isRunning: boolean = false;
  private workers: Promise<void>[] = [];

  constructor(config: JobQueueConfig) {
    this.supabase = config.supabase;
    this.maxConcurrentJobs = config.maxConcurrentJobs || 3;
    this.pollIntervalMs = config.pollIntervalMs || 5000;
    this.defaultMaxRetries = config.defaultMaxRetries || 3;
  }

  /**
   * Register a processor for a job type
   */
  registerProcessor(jobType: JobType, processor: JobProcessor): void {
    this.processors[jobType] = processor;
  }

  /**
   * Create a new research job
   */
  async createJob(job: Omit<ResearchJob, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ResearchJob> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('research_jobs')
      .insert({
        name: job.name,
        description: job.description,
        type: job.type,
        status: job.scheduledAt && new Date(job.scheduledAt) > new Date() ? 'pending' : 'queued',
        search_params: job.searchParams,
        sources: job.searchParams?.sources || ['apollo'],
        progress_percentage: 0,
        total_records: job.totalRecords || 0,
        processed_records: 0,
        success_count: 0,
        error_count: 0,
        skip_count: 0,
        retry_count: 0,
        max_retries: job.maxRetries || this.defaultMaxRetries,
        scheduled_at: job.scheduledAt,
        created_by: job.createdBy,
        organization_id: job.organizationId,
        assign_to_campaign_id: job.assignToCampaignId,
        assign_to_user_id: job.assignToUserId,
        tags: job.tags || [],
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`);
    }

    return this.transformFromRow(data);
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, progress: Partial<JobProgress>): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (progress.percentage !== undefined) updates.progress_percentage = progress.percentage;
    if (progress.processed !== undefined) updates.processed_records = progress.processed;
    if (progress.total !== undefined) updates.total_records = progress.total;

    const { error } = await this.supabase
      .from('research_jobs')
      .update(updates)
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to update progress for job ${jobId}:`, error);
    }
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string, resultSummary: ResearchJob['resultSummary']): Promise<void> {
    const { error } = await this.supabase
      .from('research_jobs')
      .update({
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        result_summary: resultSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }
  }

  /**
   * Fail a job
   */
  async failJob(jobId: string, error: string, details?: Record<string, unknown>): Promise<void> {
    const { data: job } = await this.supabase
      .from('research_jobs')
      .select('retry_count, max_retries')
      .eq('id', jobId)
      .single();

    const retryCount = job?.retry_count || 0;
    const maxRetries = job?.max_retries || this.defaultMaxRetries;
    const shouldRetry = retryCount < maxRetries;

    const updates: Record<string, unknown> = {
      last_error: error,
      error_details: details || {},
      updated_at: new Date().toISOString(),
    };

    if (shouldRetry) {
      updates.status = 'queued';
      updates.retry_count = retryCount + 1;
    } else {
      updates.status = 'failed';
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await this.supabase
      .from('research_jobs')
      .update(updates)
      .eq('id', jobId);

    if (updateError) {
      console.error(`Failed to update failed job ${jobId}:`, updateError);
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    // Abort running job
    const controller = this.runningJobs.get(jobId);
    if (controller) {
      controller.abort();
    }

    const { error } = await this.supabase
      .from('research_jobs')
      .update({
        status: 'cancelled',
        last_error: reason || 'Manually cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to cancel job: ${error.message}`);
    }
  }

  /**
   * Pause a job
   */
  async pauseJob(jobId: string): Promise<void> {
    const controller = this.runningJobs.get(jobId);
    if (controller) {
      controller.abort();
    }

    const { error } = await this.supabase
      .from('research_jobs')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to pause job: ${error.message}`);
    }
  }

  /**
   * Resume a paused job
   */
  async resumeJob(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('research_jobs')
      .update({
        status: 'queued',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .eq('status', 'paused');

    if (error) {
      throw new Error(`Failed to resume job: ${error.message}`);
    }
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<ResearchJob | null> {
    const { data, error } = await this.supabase
      .from('research_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;
    return this.transformFromRow(data);
  }

  /**
   * Get jobs with filters
   */
  async getJobs(options?: {
    status?: JobStatus;
    type?: JobType;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: ResearchJob[]; count: number }> {
    let query = this.supabase
      .from('research_jobs')
      .select('*', { count: 'exact' });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.type) {
      query = query.eq('type', options.type);
    }
    if (options?.createdBy) {
      query = query.eq('created_by', options.createdBy);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1);

    if (error) {
      throw new Error(`Failed to get jobs: ${error.message}`);
    }

    return {
      jobs: (data || []).map(this.transformFromRow),
      count: count || 0,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    totalActive: number;
    byStatus: Record<JobStatus, number>;
    averageProgress: number;
  }> {
    const { data, error } = await this.supabase
      .rpc('get_research_queue_stats');

    if (error) {
      // Fallback query
      const { data: fallback } = await this.supabase
        .from('research_jobs')
        .select('status, progress_percentage')
        .in('status', ['pending', 'queued', 'running', 'paused']);

      const byStatus: Record<JobStatus, number> = {
        pending: 0, queued: 0, running: 0, paused: 0,
        completed: 0, failed: 0, cancelled: 0,
      };
      
      let totalProgress = 0;
      fallback?.forEach(job => {
        byStatus[job.status as JobStatus] = (byStatus[job.status as JobStatus] || 0) + 1;
        totalProgress += job.progress_percentage;
      });

      const totalActive = fallback?.length || 0;
      return {
        totalActive,
        byStatus,
        averageProgress: totalActive > 0 ? totalProgress / totalActive : 0,
      };
    }

    const stats: Record<JobStatus, number> = {
      pending: 0, queued: 0, running: 0, paused: 0,
      completed: 0, failed: 0, cancelled: 0,
    };
    let avgProgress = 0;

    data?.forEach((row: { status: string; count: number; avg_progress: number }) => {
      stats[row.status as JobStatus] = parseInt(row.count as unknown as string, 10) || 0;
      if (['running', 'paused'].includes(row.status)) {
        avgProgress = row.avg_progress || 0;
      }
    });

    return {
      totalActive: stats.pending + stats.queued + stats.running + stats.paused,
      byStatus: stats,
      averageProgress: avgProgress,
    };
  }

  /**
   * Start the job processor workers
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.workers = [];

    // Start concurrent workers
    for (let i = 0; i < this.maxConcurrentJobs; i++) {
      this.workers.push(this.workerLoop());
    }

    console.log(`Started ${this.maxConcurrentJobs} job workers`);
  }

  /**
   * Stop all job processor workers
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Abort all running jobs
    this.runningJobs.forEach(controller => controller.abort());
    this.runningJobs.clear();

    // Wait for workers to finish
    await Promise.all(this.workers);
    console.log('Job queue stopped');
  }

  /**
   * Worker loop that processes jobs
   */
  private async workerLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const job = await this.claimJob();
        
        if (job) {
          await this.processJob(job);
        } else {
          await this.sleep(this.pollIntervalMs);
        }
      } catch (error) {
        console.error('Worker error:', error);
        await this.sleep(this.pollIntervalMs);
      }
    }
  }

  /**
   * Claim a job from the queue
   */
  private async claimJob(): Promise<ResearchJob | null> {
    const { data, error } = await this.supabase
      .from('research_jobs')
      .select('*')
      .in('status', ['queued', 'pending'])
      .or('scheduled_at.is.null,scheduled_at.lte.now()')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) return null;

    // Mark as running
    const { error: updateError } = await this.supabase
      .from('research_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .eq('status', data.status);

    if (updateError) return null;

    return this.transformFromRow(data);
  }

  /**
   * Process a single job
   */
  private async processJob(job: ResearchJob): Promise<void> {
    const processor = this.processors[job.type];
    
    if (!processor) {
      await this.failJob(job.id, `No processor registered for job type: ${job.type}`);
      return;
    }

    const controller = new AbortController();
    this.runningJobs.set(job.id, controller);

    try {
      const updateProgress = (progress: JobProgress) => {
        this.updateProgress(job.id, progress);
      };

      const success = await processor(job, updateProgress);

      if (success) {
        await this.completeJob(job.id, job.resultSummary);
      } else if (!controller.signal.aborted) {
        await this.failJob(job.id, 'Processor returned false');
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        await this.failJob(
          job.id,
          error instanceof Error ? error.message : 'Unknown error',
          { stack: error instanceof Error ? error.stack : undefined }
        );
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Transform database row to ResearchJob object
   */
  private transformFromRow(row: Record<string, unknown>): ResearchJob {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as JobType,
      status: row.status as JobStatus,
      searchParams: (row.search_params as Record<string, unknown>) || {},
      progressPercentage: row.progress_percentage as number || 0,
      totalRecords: row.total_records as number || 0,
      processedRecords: row.processed_records as number || 0,
      successCount: row.success_count as number || 0,
      errorCount: row.error_count as number || 0,
      skipCount: row.skip_count as number || 0,
      resultSummary: row.result_summary as ResearchJob['resultSummary'],
      lastError: row.last_error as string | undefined,
      errorDetails: row.error_details as Record<string, unknown> | undefined,
      retryCount: row.retry_count as number || 0,
      maxRetries: row.max_retries as number || 3,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at as string) : undefined,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      createdBy: row.created_by as string,
      organizationId: row.organization_id as string | undefined,
      assignToCampaignId: row.assign_to_campaign_id as string | undefined,
      assignToUserId: row.assign_to_user_id as string | undefined,
      tags: row.tags as string[] || [],
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create job queue from Supabase client
 */
export function createJobQueue(supabase: SupabaseClient, config?: Partial<JobQueueConfig>): ResearchJobQueue {
  return new ResearchJobQueue({
    supabase,
    ...config,
  });
}

export default ResearchJobQueue;
