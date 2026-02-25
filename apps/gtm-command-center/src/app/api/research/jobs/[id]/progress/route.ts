/**
 * Job Progress API
 * GET /api/research/jobs/[id]/progress
 * UI-ready progress tracking endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/research/jobs/[id]/progress - Get job progress
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
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

    // Get job with progress info
    const { data: job, error } = await supabase
      .from('research_jobs')
      .select(`
        id,
        status,
        progress_percentage,
        total_records,
        processed_records,
        success_count,
        error_count,
        skip_count,
        result_summary,
        last_error,
        started_at,
        completed_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Calculate additional metrics
    const now = new Date();
    const startedAt = job.started_at ? new Date(job.started_at) : null;
    const completedAt = job.completed_at ? new Date(job.completed_at) : null;
    
    let estimatedTimeRemaining: number | null = null;
    let processingRate: number | null = null;
    
    if (startedAt && !completedAt && job.processed_records > 0) {
      const elapsedMs = now.getTime() - startedAt.getTime();
      const recordsPerMs = job.processed_records / elapsedMs;
      const remainingRecords = (job.total_records || 0) - job.processed_records;
      estimatedTimeRemaining = Math.ceil((remainingRecords / recordsPerMs) / 1000); // seconds
      processingRate = Math.round(recordsPerMs * 1000 * 60); // records per minute
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: {
        percentage: job.progress_percentage,
        processed: job.processed_records,
        total: job.total_records || 0,
      },
      counts: {
        success: job.success_count || 0,
        error: job.error_count || 0,
        skipped: job.skip_count || 0,
      },
      results: job.result_summary || {},
      error: job.last_error,
      timing: {
        startedAt: job.started_at,
        completedAt: job.completed_at,
        updatedAt: job.updated_at,
      },
      estimates: {
        estimatedTimeRemaining,
        processingRate,
      },
    });
  } catch (error) {
    console.error(`GET /api/research/jobs/[id]/progress error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
