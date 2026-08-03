import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/database/server-supabase';
import { renderElementorToHtml, type ElementorNode } from '@/lib/preview/render';

/**
 * Renders a project's actual generated Elementor content as a live HTML
 * page. This is what "preview" should mean - the Preview tab embeds this
 * in an <iframe>, replacing the old fake previewImage <img> that pointed
 * at a URL that never existed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const appUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
    if (!appUser) {
      return new NextResponse('User not found', { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId: appUser.id },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const elementorData = project.elementorData as { elements?: ElementorNode[] } | null;
    const brandTokens = project.brandTokens as
      | { colors?: { primary?: string; secondary?: string }; typography?: { headingFont?: string; bodyFont?: string } }
      | undefined;

    console.log('[Render] Project:', project.id, 'elementorData.elements count:', elementorData?.elements?.length ?? 0);

    const html = renderElementorToHtml(elementorData?.elements ?? [], {
      title: project.businessName,
      brandTokens,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error rendering preview:', error);
    return new NextResponse('<p>Failed to render preview.</p>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
