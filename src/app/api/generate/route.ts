/**
 * Generation API
 * 
 * POST /api/generate - Start or resume website generation
 * GET /api/generate/[projectId] - Get generation progress
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { GenerationPipeline, createPipeline, getPipelineProgress } from '@/lib/generator/pipeline';
import { applyModifications, type ModificationBatch } from '@/lib/elementor/modifier';
import { validateElementorJson } from '@/lib/elementor/validator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST(request: Request) {
  try {
    // Get user from auth
    const supabase = getSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
