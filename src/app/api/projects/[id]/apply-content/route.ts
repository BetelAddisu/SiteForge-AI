import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { findAllNodesByWidgetType, setNodeContent } from '@/lib/elementor/modifier';
import type { ElementorNode } from '@/lib/elementor/parser';
import { validateElementorJson } from '@/lib/elementor/validator';

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
    if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await prisma.project.findFirst({ where: { id, userId: appUser.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.templateId) return NextResponse.json({ error: 'No template selected. Generate the website first.' }, { status: 400 });
    if (!project.generatedContent) return NextResponse.json({ error: 'No content to apply.' }, { status: 400 });

    const template = await prisma.template.findUnique({ where: { id: project.templateId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Real widget content lives on TemplateSection.content (set by import scripts),
    // NOT on Template.metadata - that only ever held manifest bookkeeping.
    const section = await prisma.templateSection.findFirst({ where: { templateId: template.id } });
    const sourceContent = (section?.content as unknown[]) ?? (template.metadata as { content?: unknown[] } | null)?.content ?? [];

    if (sourceContent.length === 0) {
      return NextResponse.json(
        { error: `Template "${template.name}" has no widget content available. Re-run template import for this template.` },
        { status: 422 }
      );
    }

    // Make a DEEP COPY - we never modify the original template!
    // This preserves the template for reuse across multiple projects.
    const contentTree = JSON.parse(JSON.stringify(sourceContent)) as ElementorNode[];

    const generatedContent = project.generatedContent as {
      homepage?: {
        hero?: { heading?: string; subheading?: string; ctaText?: string };
        about?: { heading?: string; paragraphs?: string[] };
        services?: Array<{ title?: string; description?: string }>;
      };
    };
    const hero = generatedContent.homepage?.hero;
    const about = generatedContent.homepage?.about;
    const services = generatedContent.homepage?.services ?? [];

    // Distribute across ALL matching widgets in document order, not just
    // the first one of each type - matches the same strategy used in the
    // generation pipeline (see pipeline.ts stepModifyJson), so edits made
    // here behave the same way edits made during generation do.
    const headingTexts = [hero?.heading, about?.heading, ...services.map(s => s.title)]
      .filter((t): t is string => Boolean(t));
    const textEditorTexts = [hero?.subheading, ...(about?.paragraphs ?? []), ...services.map(s => s.description)]
      .filter((t): t is string => Boolean(t));
    const buttonTexts = [hero?.ctaText].filter((t): t is string => Boolean(t));

    const appliedModifications: string[] = [];

    const headingNodes = findAllNodesByWidgetType(contentTree, 'heading');
    headingTexts.forEach((text, i) => {
      if (headingNodes[i]) {
        setNodeContent(headingNodes[i], text);
        appliedModifications.push(`heading[${i}] -> "${text.slice(0, 40)}"`);
      }
    });

    const textEditorNodes = findAllNodesByWidgetType(contentTree, 'text-editor');
    textEditorTexts.forEach((text, i) => {
      if (textEditorNodes[i]) {
        setNodeContent(textEditorNodes[i], text);
        appliedModifications.push(`text-editor[${i}] -> "${text.slice(0, 40)}"`);
      }
    });

    const buttonNodes = findAllNodesByWidgetType(contentTree, 'button');
    buttonTexts.forEach((text, i) => {
      if (buttonNodes[i]) {
        setNodeContent(buttonNodes[i], text);
        appliedModifications.push(`button[${i}] -> "${text.slice(0, 40)}"`);
      }
    });

    const validation = validateElementorJson(contentTree);
    if (!validation.valid) return NextResponse.json({ error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}` }, { status: 422 });

    await prisma.project.update({ where: { id }, data: { elementorData: { version: '0.3', elements: contentTree } as object } });
    return NextResponse.json({ success: true, modifications: appliedModifications });
  } catch (error) {
    console.error('Error applying content:', error);
    return NextResponse.json({ error: 'Failed to apply content' }, { status: 500 });
  }
}
