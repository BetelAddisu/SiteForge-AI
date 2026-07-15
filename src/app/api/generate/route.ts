/**
 * Generation API
 * 
 * POST /api/generate - Start or resume website generation
 * GET /api/generate/[projectId] - Get generation progress
 */

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createPipeline, getPipelineProgress } from '@/lib/generator/pipeline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

// Create Supabase server client that reads from cookies
async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore errors in read-only context
            }
          });
        },
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    // Get user from auth
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('POST /api/generate - Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        message: 'Please sign in to generate a website',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const body = await request.json();
    const { 
      projectId,
      businessName,
      industry,
      description,
      stylePreset,
      brandColors,
      selectedTemplates,
      resume,
    } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Verify project belongs to user
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId, userId: appUser.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check for Gemini API key
    if (!geminiApiKey) {
      return NextResponse.json({ 
        error: 'AI not configured', 
        message: 'GEMINI_API_KEY is not set in environment variables' 
      }, { status: 500 });
    }

    // Create and run pipeline
    const pipeline = createPipeline(geminiApiKey);
    
    if (resume) {
      await pipeline.initialize(projectId);
      const result = await pipeline.resume({
        projectId,
        businessData: {
          businessName,
          industry,
          description,
          stylePreset,
          brandColors,
        },
        selectedTemplates,
      });

      return NextResponse.json({
        success: result.success,
        previewUrl: result.previewUrl,
        error: result.error,
        completedSteps: result.completedSteps,
      });
    } else {
      await pipeline.initialize(projectId);
      const result = await pipeline.run({
        projectId,
        businessData: {
          businessName: businessName || project.businessName,
          industry: industry || project.industry || 'Technology',
          description: description || project.description,
          stylePreset: stylePreset || project.stylePreset,
          brandColors: brandColors || (project.brandColors as { primary?: string; secondary?: string } | null),
        },
        selectedTemplates,
      });

      return NextResponse.json({
        success: result.success,
        previewUrl: result.previewUrl,
        error: result.error,
        completedSteps: result.completedSteps,
      });
    }
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ 
      error: 'Generation failed', 
      message: String(error) 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const progress = await getPipelineProgress(projectId);

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json({ 
      error: 'Failed to get progress', 
      message: String(error) 
    }, { status: 500 });
  }
}
