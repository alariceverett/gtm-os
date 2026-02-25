/**
 * Job Queue Service
 * Server-side service for managing the research job queue
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ResearchJobQueue from '@/lib/research/job-queue';

let queueInstance: ResearchJobQueue | null = null;

/**
 * Get or initialize the global job queue instance
 */
export function getJobQueue(): ResearchJobQueue {
  if (!queueInstance) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    queueInstance = new ResearchJobQueue({
      supabase,
      maxConcurrentJobs: parseInt(process.env.RESEARCH_WORKERS || '3', 10),
      pollIntervalMs: 5000,
      defaultMaxRetries: 3,
    });

    // Register default processors
    registerDefaultProcessors(queueInstance);
  }

  return queueInstance;
}

/**
 * Register default job processors
 */
function registerDefaultProcessors(queue: ResearchJobQueue): void {
  // Prospect search processor
  queue.registerProcessor('prospect_search', async (job, updateProgress) => {
    // Import dynamically to avoid bundling issues
    const { EnrichmentService } = await import('@/lib/apollo/enrichment');
    const service = new EnrichmentService();

    const { filters, limit } = job.searchParams;
    
    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 10,
      processed: 0,
      total: limit || 1000,
      message: 'Searching Apollo...',
    });

    // Search for prospects
    const apolloFilters = {
      organization_industries: filters?.industries,
      organization_size: filters?.companySize,
      person_titles: filters?.jobTitles,
      organization_technologies: filters?.technologies,
      organization_funding_stages: filters?.fundingStage,
      person_locations: filters?.locations,
      limit: limit || 100,
    };

    const results = await service.searchAndEnrich(apolloFilters);
    
    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 50,
      processed: results.length,
      total: results.length,
      message: 'Enriching prospects...',
    });

    // Score and save prospects
    const { ProspectQualityScorer } = await import('@/lib/scoring/prospect-quality');
    
    // Default ICP for scoring
    const scorer = new ProspectQualityScorer({
      targetIndustries: filters?.industries || ['saas', 'fintech'],
      targetSize: filters?.companySize || ['51-200', '201-500'],
      targetTitles: filters?.jobTitles || ['vp', 'director', 'head'],
      targetDepartments: ['engineering', 'operations', 'devops'],
      targetSeniorities: ['manager', 'director', 'vp', 'c-suite'],
    });

    // Process results
    let created = 0;
    for (const result of results) {
      if (result.person && result.organization) {
        const prospectData = {
          companyName: result.organization.name,
          industry: result.organization.industry,
          size: result.organization.size,
          fundingStage: result.organization.funding_stage,
          location: result.organization.location 
            ? `${result.organization.location.city}, ${result.organization.location.state}` 
            : undefined,
          techStack: result.organization.technologies || [],
          contactTitle: result.person.title,
          department: result.person.department,
          seniority: result.person.seniority,
          email: result.person.email || result.person.work_email,
          signals: result.signals,
        };

        const scored = scorer.score(prospectData);
        
        // Save to database (simplified)
        // In reality, this would be a batch insert
        created++;
      }
    }

    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 90,
      processed: created,
      total: results.length,
      message: 'Finalizing...',
    });

    // Update result summary
    job.resultSummary = {
      prospectsCreated: created,
      companiesFound: new Set(results.map(r => r.organization?.name).filter(Boolean)).size,
      enrichmentRate: results.filter(r => r.confidence > 70).length / results.length,
    };

    return true;
  });

  // Company enrichment processor
  queue.registerProcessor('company_enrichment', async (job, updateProgress) => {
    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 0,
      processed: 0,
      total: 100,
      message: 'Starting company enrichment...',
    });

    // TODO: Implement company enrichment
    await new Promise(resolve => setTimeout(resolve, 1000));

    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 100,
      processed: 100,
      total: 100,
      message: 'Completed',
    });

    return true;
  });

  // Signal detection processor
  queue.registerProcessor('signal_detection', async (job, updateProgress) => {
    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 0,
      processed: 0,
      total: 100,
      message: 'Scanning for buying signals...',
    });

    // TODO: Implement signal detection
    await new Promise(resolve => setTimeout(resolve, 1000));

    job.resultSummary = {
      signalsDetected: {
        funding: 0,
        hiring: 0,
      },
    };

    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 100,
      processed: 100,
      total: 100,
      message: 'Completed',
    });

    return true;
  });

  // Bulk import processor
  queue.registerProcessor('bulk_import', async (job, updateProgress) => {
    updateProgress({
      jobId: job.id,
      status: 'running',
      percentage: 0,
      processed: 0,
      total: job.totalRecords,
      message: 'Processing import...',
    });

    // TODO: Implement bulk import
    await new Promise(resolve => setTimeout(resolve, 1000));

    return true;
  });
}

/**
 * Exported singleton instance methods
 */
export const jobQueueService = {
  /**
   * Start the job queue workers
   */
  async start(): Promise<void> {
    const queue = getJobQueue();
    await queue.start();
  },

  /**
   * Stop the job queue workers
   */
  async stop(): Promise<void> {
    if (queueInstance) {
      await queueInstance.stop();
      queueInstance = null;
    }
  },

  /**
   * Get queue statistics
   */
  async getStats(supabase?: SupabaseClient) {
    const queue = getJobQueue();
    return queue.getQueueStats();
  },

  /**
   * Get a job by ID
   */
  async getJob(id: string, supabase?: SupabaseClient) {
    const queue = getJobQueue();
    return queue.getJob(id);
  },

  /**
   * Create a new job
   */
  async createJob(job: Parameters<ResearchJobQueue['createJob']>[0], supabase?: SupabaseClient) {
    const queue = getJobQueue();
    return queue.createJob(job);
  },

  /**
   * Cancel a job
   */
  async cancelJob(id: string, reason?: string, supabase?: SupabaseClient) {
    const queue = getJobQueue();
    return queue.cancelJob(id, reason);
  },
};

export default jobQueueService;
