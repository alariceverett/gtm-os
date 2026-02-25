/**
 * Templates API Route
 * 
 * GET /api/templates - List templates
 * POST /api/templates - Create template
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCreateTemplate, validateTemplateQuery } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';

/**
 * List email templates
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    
    const validation = validateTemplateQuery(params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.errors },
        { status: 400 }
      );
    }

    const { status, category, limit, offset, search } = {
      status: params.status,
      category: params.category,
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
      .from('email_templates')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    // Apply pagination
    query = query
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 20) - 1);

    // Execute query
    const { data: templates, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates', code: error.code },
        { status: 500 }
      );
    }

    const total = count || 0;

    return NextResponse.json({
      data: templates || [],
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
 * Create new template
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate body
    const body = await request.json();
    const validation = validateCreateTemplate(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.errors },
        { status: 400 }
      );
    }

    const templateData = body as Record<string, unknown>;

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
      .from('email_templates')
      .select('id')
      .eq('slug', templateData.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Template with this slug already exists' },
        { status: 409 }
      );
    }

    // Create template
    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({
        ...templateData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Template insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create template', code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: template },
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