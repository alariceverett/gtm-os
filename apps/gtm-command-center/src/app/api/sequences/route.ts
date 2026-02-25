/**
 * Sequences API Route - GET /api/sequences
 * 
 * List all email sequences with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCreateSequence, validateSequenceQuery } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * List email sequences
 * 
 * Query params:
 * - status: 'all' | 'draft' | 'active' | 'paused' | 'archived'
 * - sequence_type: 'cold_outreach' | 'nurture' | 're_engagement' | 'follow_up'
 * - limit: number (1-100, default 20)
 * - offset: number (default 0)
 * - search: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const validation = validateSequenceQuery(params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    const { status, sequence_type, limit, offset, search } = {
      status: params.status,
      sequence_type: params.sequence_type,
      limit: parseInt(params.limit || '20', 10),
      offset: parseInt(params.offset || '0', 10),
      search: params.search,
    };

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

    // Build query
    let query = supabase
      .from('email_sequences')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (sequence_type) {
      query = query.eq('sequence_type', sequence_type);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    query = query
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 20) - 1);

    // Execute query
    const { data: sequences, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sequences', code: error.code },
        { status: 500 }
      );
    }

    // Get step counts for each sequence
    const sequenceIds = sequences?.map(s => s.id) || [];
    let stepCounts: Record<string, number> = {};
    
    if (sequenceIds.length > 0) {
      const { data: steps } = await supabase
        .from('email_sequence_steps')
        .select('sequence_id')
        .in('sequence_id', sequenceIds);
      
      stepCounts = (steps || []).reduce((acc, step) => {
        acc[step.sequence_id] = (acc[step.sequence_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    // Response with pagination
    const total = count || 0;
    const paginatedData = sequences?.map(seq => ({
      ...seq,
      step_count: stepCounts[seq.id] || 0,
    })) || [];

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        limit,
        offset,
        total,
        has_more: total > (offset || 0) + (limit || 20),
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
 * Create new sequence
 * 
 * Body: CreateSequenceInput
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate body
    const body = await request.json();
    
    const validation = validateCreateSequence(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.errors },
        { status: 400 }
      );
    }

    const sequenceData = body as Record<string, unknown>;

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

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('email_sequences')
      .select('id')
      .eq('slug', sequenceData.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Sequence with this slug already exists' },
        { status: 409 }
      );
    }

    // Extract steps from sequence data
    const { steps, ...sequenceInfo } = sequenceData;

    // Create sequence
    const { data: sequence, error: seqError } = await supabase
      .from('email_sequences')
      .insert({
        ...sequenceInfo,
        created_by: user.id,
      })
      .select()
      .single();

    if (seqError) {
      console.error('Sequence insert error:', seqError);
      return NextResponse.json(
        { error: 'Failed to create sequence', code: seqError.code },
        { status: 500 }
      );
    }

    // Create steps
    if (steps && steps.length > 0) {
      const stepsWithSequence = steps.map(step => ({
        ...step,
        sequence_id: sequence.id,
      }));

      const { error: stepsError } = await supabase
        .from('email_sequence_steps')
        .insert(stepsWithSequence);

      if (stepsError) {
        console.error('Steps insert error:', stepsError);
        // Rollback sequence creation
        await supabase
          .from('email_sequences')
          .delete()
          .eq('id', sequence.id);
        
        return NextResponse.json(
          { error: 'Failed to create sequence steps', code: stepsError.code },
          { status: 500 }
        );
      }
    }

    // Fetch complete sequence with steps
    const { data: completeSequence } = await supabase
      .from('email_sequences')
      .select(`
        *,
        steps:email_sequence_steps(*)
      `)
      .eq('id', sequence.id)
      .single();

    return NextResponse.json(
      { data: completeSequence || sequence },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}