/**
 * Enrollment Detail API Route
 * 
 * GET /api/enrollments/[id] - Get enrollment details
 * DELETE /api/enrollments/[id] - Unenroll prospect
 * PUT /api/enrollments/[id] - Update enrollment (pause/resume)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Get enrollment by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid enrollment ID' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch enrollment with related data
    const { data: enrollment, error } = await supabase
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:sequence_id(
          name,
          slug,
          sequence_type,
          abort_on_reply,
          abort_on_meeting
        ),
        prospect:prospect_id(
          id,
          name,
          email,
          title,
          company,
          industry,
          tech_stack
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Enrollment not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch enrollment', code: error.code },
        { status: 500 }
      );
    }

    // Fetch send history
    const { data: sends } = await supabase
      .from('email_sends')
      .select('*')
      .eq('sequence_enrollment_id', id)
      .order('sent_at', { ascending: false });

    // Fetch events
    const { data: events } = await supabase
      .from('email_events')
      .select('*')
      .in('send_id', (sends || []).map(s => s.id))
      .order('created_at', { ascending: false });

    return NextResponse.json({
      data: {
        ...enrollment,
        sends: sends || [],
        events: events || [],
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update enrollment (pause/resume)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid enrollment ID' },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json();
    const { action } = body as { action: 'pause' | 'resume' };

    if (!action || !['pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "pause" or "resume"' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check enrollment exists
    const { data: existing } = await supabase
      .from('sequence_enrollments')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    if (action === 'pause') {
      if (existing.status !== 'active') {
        return NextResponse.json(
          { error: 'Can only pause active enrollments' },
          { status: 400 }
        );
      }

      const { data: enrollment, error } = await supabase
        .from('sequence_enrollments')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to pause enrollment', code: error.code },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: enrollment,
        message: 'Enrollment paused',
      });
    }

    if (action === 'resume') {
      if (existing.status !== 'paused') {
        return NextResponse.json(
          { error: 'Can only resume paused enrollments' },
          { status: 400 }
        );
      }

      const { data: enrollment, error } = await supabase
        .from('sequence_enrollments')
        .update({
          status: 'active',
          resumed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'Failed to resume enrollment', code: error.code },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: enrollment,
        message: 'Enrollment resumed',
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Unenroll a prospect (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid enrollment ID' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check enrollment exists
    const { data: existing } = await supabase
      .from('sequence_enrollments')
      .select('id, status, sequence_id, prospect_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Enrollment not found' },
        { status: 404 }
      );
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Enrollment already cancelled' },
        { status: 400 }
      );
    }

    // Cancel enrollment
    const { data: enrollment, error } = await supabase
      .from('sequence_enrollments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        cancelled_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Enrollment cancel error:', error);
      return NextResponse.json(
        { error: 'Failed to cancel enrollment', code: error.code },
        { status: 500 }
      );
    }

    // Cancel any pending sends
    await supabase
      .from('email_sends')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('sequence_enrollment_id', id)
      .eq('status', 'pending');

    return NextResponse.json({
      message: 'Enrollment cancelled successfully',
      data: enrollment,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}