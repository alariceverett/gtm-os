/**
 * Sequence Detail API Route
 * 
 * GET /api/sequences/[id] - Get sequence by ID
 * PUT /api/sequences/[id] - Update sequence
 * DELETE /api/sequences/[id] - Soft delete sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUpdateSequence } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Get single sequence with steps
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid sequence ID' },
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

    // Fetch sequence with steps
    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*)
      `)
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Sequence not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sequence', code: error.code },
        { status: 500 }
      );
    }

    // Fetch enrollment stats
    const { data: stats } = await supabase
      .from('sequence_analytics')
      .select('*')
      .eq('sequence_id', id)
      .maybeSingle();

    return NextResponse.json({
      data: {
        ...sequence,
        analytics: stats || null,
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
 * Update sequence
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid sequence ID' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = validateUpdateSequence(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.errors },
        { status: 400 }
      );
    }

    const updateData = body as Record<string, unknown>;

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

    // Check sequence exists and belongs to user
    const { data: existing } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // Handle steps update if provided
    const { steps, ...sequenceUpdate } = updateData;

    // Update sequence
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .update({
        ...sequenceUpdate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (seqError) {
      console.error('Sequence update error:', seqError);
      return NextResponse.json(
        { error: 'Failed to update sequence', code: seqError.code },
        { status: 500 }
      );
    }

    // Handle steps update
    if (steps && steps.length > 0) {
      // Delete existing steps
      const { error: deleteError } = await supabase
        .from('email_sequence_steps')
        .delete()
        .eq('sequence_id', id);

      if (deleteError) {
        console.error('Steps delete error:', deleteError);
      }

      // Insert new steps
      const stepsWithSequence = steps.map(step => ({
        ...step,
        sequence_id: id,
      }));

      const { error: stepsError } = await supabase
        .from('email_sequence_steps')
        .insert(stepsWithSequence);

      if (stepsError) {
        console.error('Steps insert error:', stepsError);
        return NextResponse.json(
          { error: 'Failed to update sequence steps', code: stepsError.code },
          { status: 500 }
        );
      }
    }

    // Fetch updated sequence
    const { data: completeSequence } = await supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*)
      `)
      .eq('id', id)
      .single();

    return NextResponse.json({ data: completeSequence || sequence });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Soft delete sequence (set status to archived)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid sequence ID' },
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

    // Check sequence exists and belongs to user
    const { data: existing } = await supabase
      .from('email_sequences')
      .select('id, status')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404 }
      );
    }

    // Soft delete by archiving
    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('Sequence delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete sequence', code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Sequence archived successfully',
      data: sequence,
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