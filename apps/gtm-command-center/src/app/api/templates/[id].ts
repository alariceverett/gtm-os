/**
 * Template Detail API Route
 * 
 * GET /api/templates/[id] - Get template
 * PUT /api/templates/[id] - Update template
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUpdateTemplate } from '@/lib/validation';
import { createClient } from '@/lib/supabase/server';
import { previewTemplate, personalize } from '@/lib/personalization';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Get single template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
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

    // Fetch template
    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch template', code: error.code },
        { status: 500 }
      );
    }

    // Get usage count in sequences
    const { count: usageCount } = await supabase
      .from('email_sequence_steps')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', id);

    return NextResponse.json({
      data: {
        ...template,
        usage_count: usageCount || 0,
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
 * Update template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validation = validateUpdateTemplate(body);
    
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

    // Check template exists and belongs to user
    const { data: existing } = await supabase
      .from('email_templates')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Update template
    const { data: template, error } = await supabase
      .from('email_templates')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('Template update error:', error);
      return NextResponse.json(
        { error: 'Failed to update template', code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: template });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Preview template with personalization
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Validate UUID
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    
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

    // Fetch template
    const { data: template, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch template', code: error.code },
        { status: 500 }
      );
    }

    // Validate body type
    const { customContext } = body;
    
    // Generate preview with custom context if provided
    const preview = customContext 
      ? personalizeEmailWithContext(template, customContext)
      : previewTemplate(template.subject || '', template.body_text || '' || template.body_html || '');

    return NextResponse.json({
      data: {
        template_id: id,
        preview,
        tokens_used: template.tokens_used || [],
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

// Helper function
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function personalizeEmailWithContext(template: { subject?: string; body_text?: string; body_html?: string }, context: Record<string, string>) {
  const prospectData = {
    first_name: context.first_name,
    last_name: context.last_name,
    company: { name: context.company },
    title: context.title,
    industry: context.industry,
    tech_stack: context.tech_stack,
  };
  
  const personalizationContext = {
    prospect: prospectData,
    days_since_research: 3,
  };
  
  const subjectResult = personalize(template.subject || '', personalizationContext);
  const bodyResult = personalize(template.body_text || template.body_html || '', personalizationContext);
  
  return {
    subject: subjectResult.text,
    body: bodyResult.text,
    tokens: [...new Set([...subjectResult.replaced, ...bodyResult.replaced])],
    missing: [...new Set([...subjectResult.missing, ...bodyResult.missing])],
  };
}