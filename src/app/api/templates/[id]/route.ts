import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { id } = await params;

  try {
    // Get template
    const { data: template, error: templateError } = await supabase
      .from('Template')
      .select('*')
      .eq('id', id)
      .single();

    if (templateError) throw templateError;

    // Get sections
    const { data: sections, error: sectionsError } = await supabase
      .from('TemplateSection')
      .select('*')
      .eq('templateId', id);

    if (sectionsError) throw sectionsError;

    return NextResponse.json({ 
      template,
      sections: sections || [] 
    });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}
