import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

// Get Supabase client for auth
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find our user record
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ projects: [] });
    }

    // Fetch user's projects
    const projects = await prisma.project.findMany({
      where: { userId: appUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assets: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find or create our user record
    let appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      appUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || null,
        },
      });
    }

    const body = await request.json();
    const { 
      businessName, 
      industry, 
      description,
      templateId,
      stylePreset,
      brandColors,
      businessInfo,
    } = body;

    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required' }, { status: 400 });
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        userId: appUser.id,
        businessName,
        industry: industry || null,
        description: description || null,
        status: 'DRAFT',
        templateId: templateId || null,
        stylePreset: stylePreset || null,
        brandColors: brandColors ? JSON.parse(brandColors) : null,
        businessInfo: businessInfo ? JSON.parse(businessInfo) : null,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
