import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    // If Supabase is configured, fetch from database
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ projects: [] });
      }

      // Transform data to match expected format
      const transformed = (projects || []).map((p: any) => ({
        id: p.id,
        businessName: p.business_name || p.name,
        industry: p.industry || '',
        status: p.status || 'draft',
        createdAt: p.created_at,
        wordpressUrl: p.deployed_url,
      }));

      return NextResponse.json({ projects: transformed });
    }

    // Return empty array if no Supabase connection
    return NextResponse.json({ projects: [] });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ projects: [], error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // If Supabase is configured, save to database
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: body.businessName,
          business_name: body.businessName,
          industry: body.industry,
          description: body.description,
          status: 'draft',
          template_id: body.templateId,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
      }

      return NextResponse.json({ project }, { status: 201 });
    }

    // Return mock response if no Supabase
    return NextResponse.json({ 
      project: { 
        id: 'demo-' + Date.now(),
        ...body,
        status: 'draft',
        createdAt: new Date().toISOString(),
      }
    }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
