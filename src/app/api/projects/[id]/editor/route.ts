import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/database/server-supabase';
import { validateElementorJson, type ElementorNode } from '@/lib/elementor/parser';

// Normalize elementor data to consistent shape
function normalizeElementorData(rawData: unknown): {
  version: string;
  elements: ElementorNode[];
  templateId: string | null;
  templateName: string | null;
} {
  const raw = rawData as any;
  // Raw data can be:
  // - Array (from fallback generator)
  // - { version, elements, templateId } object
  // - null/undefined
  const elements = Array.isArray(raw) 
    ? raw 
    : (raw?.elements ?? []);
  
  return {
    version: raw?.version || '0.3',
    elements: Array.isArray(elements) ? elements as ElementorNode[] : [],
    templateId: raw?.templateId ?? null,
    templateName: raw?.templateName ?? null,
  };
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

    // Normalize elementor data to consistent shape
    const normalized = normalizeElementorData(project.elementorData);

    console.log('[Editor GET] Project:', id, 'elements:', normalized.elements.length);

    return NextResponse.json({
      elementorData: normalized,
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

// PUT - Save editor changes with validation
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

    if (!elementorData) {
      return NextResponse.json({ error: 'Missing elementor data' }, { status: 400 });
    }

    // Normalize and validate the incoming data
    const normalized = normalizeElementorData(elementorData);
    
    // Validate that elements is valid Elementor JSON
    if (!validateElementorJson(normalized.elements)) {
      return NextResponse.json({ 
        error: 'Invalid Elementor structure',
        details: 'Elements must be a valid array of Elementor nodes with id and elType fields'
      }, { status: 400 });
    }

    // Save to project
    await prisma.project.update({
      where: { id },
      data: {
        elementorData: {
          version: normalized.version,
          elements: normalized.elements as any,  // Cast for Prisma Json compatibility
          templateId: normalized.templateId,
          templateName: normalized.templateName,
        } as any,  // Cast for Prisma Json compatibility
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
