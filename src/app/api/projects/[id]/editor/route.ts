import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch { }
          });
        },
      },
    }
  );
}

// GET - Get project elementor data for editing
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: appUser.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Return elementor data
    const elementorData = project.elementorData as {
      version?: string;
      elements?: unknown[];
    } | null;

    console.log('[Editor GET] Project:', id, 'elementorData:', JSON.stringify(elementorData)?.slice(0, 200));

    return NextResponse.json({
      elementorData: elementorData || { elements: [] },
      project: {
        id: project.id,
        businessName: project.businessName,
        status: project.status,
      },
    });
  } catch (error) {
    console.error('Error getting project for editor:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

// PUT - Save editor changes
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: appUser.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get updated data from request
    const body = await request.json();
    const { elementorData } = body;

    if (!elementorData || !Array.isArray(elementorData.elements)) {
      return NextResponse.json({ error: 'Invalid elementor data' }, { status: 400 });
    }

    // Save to project
    await prisma.project.update({
      where: { id },
      data: {
        elementorData: {
          version: '0.3',
          ...elementorData,
        },
        status: 'PREVIEW', // Update status since content changed
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Changes saved successfully',
    });
  } catch (error) {
    console.error('Error saving editor changes:', error);
    return NextResponse.json({ error: 'Failed to save changes' }, { status: 500 });
  }
}
