/**
 * Individual Job API
 * GET/PUT/DELETE /api/research/jobs/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/research/jobs/[id] - Get single job
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

    const { data: job, error } = await supabase
      .from('research_jobs')
      .select('*')
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

    return NextResponse.json({ job });
  } catch (error) {
    console.error(`GET /api/research/jobs/[id] error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/research/jobs/[id] - Update job (pause/cancel)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, tags } = body;

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

    // Build update
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (tags !== undefined) {
      updates.tags = tags;
    }

    if (action) {
      switch (action) {
        case 'pause':
          updates.status = 'paused';
          break;
        case 'resume':
          updates.status = 'queued';
          break;
        case 'cancel':
          updates.status = 'cancelled';
          updates.completed_at = new Date().toISOString();
          break;
        case 'retry':
          updates.status = 'queued';
          updates.retry_count = 0;
          updates.error_count = 0;
          updates.last_error = null;
          updates.error_details = {};
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }
    }

    const { data: job, error } = await supabase
      .from('research_jobs')
      .update(updates)
      .eq('id', id)
      .eq('created_by', userId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update job:', error);
      return NextResponse.json(
        { error: 'Failed to update job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error('PUT /api/research/jobs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/research/jobs/[id] - Delete job
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow deletion of completed, failed, or cancelled jobs
    const { data: job } = await supabase
      .from('research_jobs')
      .select('status')
      .eq('id', id)
      .eq('created_by', userId)
      .single();

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json(
        { error: 'Cannot delete active job. Cancel it first.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('research_jobs')
      .delete()
      .eq('id', id)
      .eq('created_by', userId);

    if (error) {
      console.error('Failed to delete job:', error);
      return NextResponse.json(
        { error: 'Failed to delete job' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('DELETE /api/research/jobs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
