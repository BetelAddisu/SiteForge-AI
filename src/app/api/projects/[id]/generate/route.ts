import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/database/server-supabase';
import { GenerationPipeline } from '@/lib/generator/pipeline';

interface GenerateRequest {
  businessName: string;
  industry?: string;
  stylePreset?: string;
  brandColors?: {
    primary?: string;
    secondary?: string;
  };
  customInstructions?: string;
  websiteUrl?: string;
  templateId?: string;
  kitId?: string;
  resume?: boolean;
}

// POST - Trigger generation for a project
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Auth check
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

    // Get project
    const project = await prisma.project.findFirst({
      where: { id, userId: appUser.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if already generating
    if (project.status === 'GENERATING') {
      return NextResponse.json({ 
        error: 'Generation already in progress',
        status: project.status 
      }, { status: 409 });
    }

    // Parse request body
    const body: GenerateRequest = await request.json();

    // Build business data from request and project
    const projectBusinessInfo = project.businessInfo as any || {};
    const businessData = {
      businessName: body.businessName || project.businessName,
      industry: body.industry || project.industry || 'general',
      description: project.description || '',
      stylePreset: body.stylePreset || project.stylePreset || 'modern',
      brandColors: (body.brandColors as any) || project.brandColors as any || {},
      websiteUrl: body.websiteUrl || projectBusinessInfo.contact?.website || projectBusinessInfo.website || undefined,
      businessInfo: projectBusinessInfo,
    };

    // Update project status
    await prisma.project.update({
      where: { id },
      data: { status: 'GENERATING' },
    });

    // Run pipeline
    const pipeline = new GenerationPipeline(process.env.GEMINI_API_KEY!);
    await pipeline.initialize(id);

    const selectedTemplates = body.templateId ? [body.templateId] : 
                              body.kitId ? undefined :  // Let pipeline find templates
                              project.templateId ? [project.templateId] : undefined;

    const result = await pipeline.run({
      projectId: id,
      businessData,
      selectedTemplates,
      resume: body.resume ?? false,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        previewUrl: result.previewUrl,
        completedSteps: result.completedSteps,
      });
    } else {
      // Update project status to FAILED
      await prisma.project.update({
        where: { id },
        data: { status: 'FAILED' },
      });

      return NextResponse.json({
        success: false,
        error: result.error || 'Generation failed',
        completedSteps: result.completedSteps,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error generating project:', error);
    
    // Update project status to FAILED
    const { id } = await params;
    await prisma.project.update({
      where: { id },
      data: { status: 'FAILED' },
    }).catch(() => {});

    return NextResponse.json({ 
      error: 'Generation failed',
      details: String(error)
    }, { status: 500 });
  }
}

// GET - Get generation status
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Auth check
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

    // Return current status
    return NextResponse.json({
      status: project.status,
      previewUrl: project.previewImage,
      checkpoint: project.checkpoint,
      hasContent: !!project.elementorData,
    });
  } catch (error) {
    console.error('Error getting generation status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
