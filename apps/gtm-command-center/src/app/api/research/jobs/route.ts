/**
 * Research Jobs API
 * REST endpoints for job management (UI-ready)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { jobQueueService } from '@/lib/services/job-queue-service';

// Validation schemas
const createJobSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum([
    'prospect_search',
    'company_enrichment',
    'bulk_import',
    'signal_detection',
    'list_building',
    'data_cleansing',
    'competitor_research',
  ]),
  searchParams: z.object({
    filters: z.object({
      industries: z.array(z.string()).optional(),
      companySize: z.array(z.string()).optional(),
      jobTitles: z.array(z.string()).optional(),
      technologies: z.array(z.string()).optional(),
      fundingStage: z.array(z.string()).optional(),
      signalTypes: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      excludeCompanies: z.array(z.string()).optional(),
    }).optional(),
    limit: z.number().min(1).max(10000).default(1000),
    sortBy: z.string().optional(),
    sources: z.array(z.string()).default(['apollo']),
  }).optional().default({ limit: 1000, sources: ['apollo'] }),
  scheduledAt: z.string().datetime().optional(),
  assignToCampaignId: z.string().uuid().optional(),
  assignToUserId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
});

const updateJobSchema = z.object({
  status: z.enum(['paused', 'cancelled']).optional(),
  tags: z.array(z.string()).optional(),
});

// GET /api/research/jobs - List jobs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query params
    const status = searchParams.get('status') as any;
    const type = searchParams.get('type') as any;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Create server-side Supabase client
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

    // Get current user from request headers
    const userId = request.headers.get('x-user-id');
    
    // Build query
    let query = supabase
      .from('research_jobs')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data: jobs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to fetch jobs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      jobs: jobs || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('GET /api/research/jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/research/jobs - Create new job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = createJobSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const validated = validationResult.data;

    // Create server-side Supabase client
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

    // Get user ID from header (set by middleware)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create the job
    const { data: job, error } = await supabase
      .from('research_jobs')
      .insert({
        name: validated.name,
        description: validated.description,
        type: validated.type,
        status: validated.scheduledAt ? 'pending' : 'queued',
        search_params: validated.searchParams,
        sources: validated.searchParams.sources || ['apollo'],
        progress_percentage: 0,
        total_records: 0,
        processed_records: 0,
        success_count: 0,
        error_count: 0,
        skip_count: 0,
        retry_count: 0,
        max_retries: 3,
        scheduled_at: validated.scheduledAt,
        created_by: userId,
        assign_to_campaign_id: validated.assignToCampaignId,
        assign_to_user_id: validated.assignToUserId,
        tags: validated.tags,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create job:', error);
      return NextResponse.json(
        { error: 'Failed to create job', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('POST /api/research/jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/research/jobs - Bulk update (pause/cancel)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobIds, action } = body;

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json(
        { error: 'jobIds array is required' },
        { status: 400 }
      );
    }

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be pause, resume, or cancel' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
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

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Map action to status
    let newStatus: string;
    switch (action) {
      case 'pause':
        newStatus = 'paused';
        break;
      case 'resume':
        newStatus = 'queued';
        break;
      case 'cancel':
        newStatus = 'cancelled';
        break;
      default:
        newStatus = 'queued';
    }

    // Update jobs
    const { data: jobs, error } = await supabase
      .from('research_jobs')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(action === 'cancel' ? { completed_at: new Date().toISOString() } : {}),
      })
      .in('id', jobIds)
      .eq('created_by', userId)
      .select();

    if (error) {
      console.error('Failed to update jobs:', error);
      return NextResponse.json(
        { error: 'Failed to update jobs', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated: jobs?.length || 0,
      action,
      jobs: jobs || [],
    });
  } catch (error) {
    console.error('PUT /api/research/jobs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
