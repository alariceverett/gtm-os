/**
 * Enrollments API Route
 * 
 * POST /api/enrollments - Enroll prospect
 * GET /api/enrollments - List active enrollments
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCreateEnrollment, validateBulkEnrollment, validateEnrollmentQuery } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * List enrollments with filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const validation = validateEnrollmentQuery(params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    const { sequence_id, status, limit, offset } = {
      sequence_id: params.sequence_id,
      status: params.status,
      limit: parseInt(params.limit || '20', 10),
      offset: parseInt(params.offset || '0', 10),
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
      .from('sequence_enrollments')
      .select(`
        *,
        sequence:sequence_id(
          name,
          slug,
          sequence_type
        ),
        prospect:prospect_id(
          id,
          name,
          title,
          company
        )
      `, { count: 'exact' });

    // Apply sequence filter
    if (sequence_id) {
      query = query.eq('sequence_id', sequence_id);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else {
      // Default to active/pending
      query = query.in('status', ['active', 'pending']);
    }

    // Apply pagination
    query = query
      .order('enrolled_at', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 20) - 1);

    // Execute query
    const { data: enrollments, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch enrollments', code: error.code },
        { status: 500 }
      );
    }

    const total = count || 0;

    return NextResponse.json({
      data: enrollments || [],
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
 * Enroll a prospect in a sequence
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate body
    const body = await request.json();
    
    // Check if bulk enrollment
    if (Array.isArray(body.prospect_ids)) {
      return handleBulkEnrollment(body, request);
    }
    
    return handleSingleEnrollment(body, request);

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleSingleEnrollment(body: unknown, request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const validation = validateCreateEnrollment(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid request body', details: validation.errors },
      { status: 400 }
    );
  }

  const enrollmentData = body as Record<string, unknown>;

  // Verify sequence exists and is active
  const { data: sequence, error: seqError } = await supabase
    .from('email_sequences')
    .select('id, status, ab_test_enabled, ab_test_config')
    .eq('id', enrollmentData.sequence_id)
    .single();

  if (seqError || !sequence) {
    return NextResponse.json(
      { error: 'Sequence not found' },
      { status: 404 }
    );
  }

  if (sequence.status === 'archived') {
    return NextResponse.json(
      { error: 'Cannot enroll in archived sequence' },
      { status: 400 }
    );
  }

  // Check for duplicate enrollment
  const { data: existing } = await supabase
    .from('sequence_enrollments')
    .select('id, status')
    .eq('sequence_id', enrollmentData.sequence_id)
    .or(`prospect_id.eq.${enrollmentData.prospect_id},contact_id.eq.${enrollmentData.contact_id}`)
    .in('status', ['active', 'pending'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'Prospect already enrolled in this sequence', enrollment_id: existing.id },
      { status: 409 }
    );
  }

  // Assign A/B variant if configured
  let assignedVariant = enrollmentData.assigned_variant || 'control';
  if (sequence.ab_test_enabled) {
    const config = sequence.ab_test_config as { variants?: string[]; weights?: number[] } || {};
    if (config.variants && config.variants.length > 0) {
      assignedVariant = assignVariant(config);
    }
  }

  // Calculate next send time
  let nextDueAt: string | undefined;
  if (enrollmentData.start_immediately) {
    nextDueAt = new Date().toISOString();
  } else if (enrollmentData.scheduled_for) {
    nextDueAt = enrollmentData.scheduled_for;
  }

  // Create enrollment
  const { data: enrollment, error } = await supabase
    .from('sequence_enrollments')
    .insert({
      sequence_id: enrollmentData.sequence_id,
      prospect_id: enrollmentData.prospect_id,
      contact_id: enrollmentData.contact_id,
      external_lead_id: enrollmentData.external_lead_id,
      assigned_variant: assignedVariant,
      enrolled_at: new Date().toISOString(),
      started_at: enrollmentData.start_immediately ? new Date().toISOString() : undefined,
      next_due_at: nextDueAt,
      status: enrollmentData.start_immediately ? 'active' : 'pending',
      initial_context: enrollmentData.initial_context || {},
    })
    .select('*, sequence:sequence_id(name, slug)')
    .single();

  if (error) {
    console.error('Enrollment insert error:', error);
    return NextResponse.json(
      { error: 'Failed to create enrollment', code: error.code },
      { status: 500 }
    );
  }

  // Update sequence stats
  await supabase
    .from('email_sequences')
    .update({
      total_enrolled: supabase.rpc('increment', { x: 1 }),
    })
    .eq('id', enrollmentData.sequence_id);

  return NextResponse.json(
    { 
      data: {
        ...enrollment,
        assigned_variant: assignedVariant,
      },
      message: 'Enrollment created successfully',
    },
    { status: 201 }
  );
}

async function handleBulkEnrollment(body: unknown, request: NextRequest) {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const validation = validateBulkEnrollment(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: 'Invalid request body', details: validation.errors },
      { status: 400 }
    );
  }

  const bodyData = body as Record<string, unknown>;
  const sequence_id = bodyData.sequence_id as string;
  const prospect_ids = bodyData.prospect_ids as string[];
  const assigned_variant = bodyData.assigned_variant as string | undefined;
  const start_immediately = bodyData.start_immediately as boolean | undefined;
  const scheduled_for = bodyData.scheduled_for as string | undefined;

  // Verify sequence
  const { data: sequence } = await supabase
    .from('email_sequences')
    .select('id, status, ab_test_enabled, ab_test_config')
    .eq('id', sequence_id)
    .single();

  if (!sequence) {
    return NextResponse.json(
      { error: 'Sequence not found' },
      { status: 404 }
    );
  }

  // Check for existing enrollments
  const { data: existingEnrollments } = await supabase
    .from('sequence_enrollments')
    .select('prospect_id')
    .eq('sequence_id', sequence_id)
    .in('prospect_id', prospect_ids)
    .in('status', ['active', 'pending']);

  const existingIds = new Set(existingEnrollments?.map(e => e.prospect_id) || []);
  const newProspectIds = prospect_ids.filter(id => !existingIds.has(id));

  if (newProspectIds.length === 0) {
    return NextResponse.json(
      { error: 'All prospects already enrolled' },
      { status: 409 }
    );
  }

  // Calculate next due time
  let nextDueAt: string | undefined;
  if (start_immediately) {
    nextDueAt = new Date().toISOString();
  } else if (scheduled_for) {
    nextDueAt = scheduled_for;
  }

  // Create enrollments
  const enrollments = newProspectIds.map(prospectId => {
    let variant = assigned_variant || 'control';
    if (sequence.ab_test_enabled) {
      const config = sequence.ab_test_config as { variants?: string[]; weights?: number[] } || {};
      variant = assignVariant(config);
    }

    return {
      sequence_id,
      prospect_id: prospectId,
      assigned_variant: variant,
      enrolled_at: new Date().toISOString(),
      started_at: start_immediately ? new Date().toISOString() : undefined,
      next_due_at: nextDueAt,
      status: start_immediately ? 'active' : 'pending',
      initial_context: {},
    };
  });

  const { data: createdEnrollments, error } = await supabase
    .from('sequence_enrollments')
    .insert(enrollments)
    .select();

  if (error) {
    console.error('Bulk enrollment error:', error);
    return NextResponse.json(
      { error: 'Failed to create enrollments', code: error.code },
      { status: 500 }
    );
  }

  // Update sequence stats
  await supabase
    .from('email_sequences')
    .update({
      total_enrolled: supabase.rpc('increment', { x: newProspectIds.length }),
    })
    .eq('id', sequence_id);

  return NextResponse.json(
    { 
      data: {
        enrollments: createdEnrollments,
        created: newProspectIds.length,
        skipped: existingIds.size,
        assigned_variants: createdEnrollments?.reduce((acc, e) => {
          acc[e.prospect_id] = e.assigned_variant;
          return acc;
        }, {} as Record<string, string>),
      },
      message: `Enrolled ${newProspectIds.length} prospects`,
    },
    { status: 201 }
  );
}

function assignVariant(config: { variants?: string[]; weights?: number[] }): string {
  const variants = config.variants || ['control'];
  const weights = config.weights || variants.map(() => 1 / variants.length);
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const random = Math.random() * totalWeight;
  let currentWeight = 0;
  
  for (let i = 0; i < variants.length; i++) {
    currentWeight += weights[i] || 0;
    if (random <= currentWeight) {
      return variants[i];
    }
  }
  
  return variants[0];
}