import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { replaceHeading, replaceParagraph, replaceButton } from '@/lib/elementor/modifier';
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
    const contentTree = JSON.parse(JSON.stringify(sourceContent)) as Parameters<typeof replaceHeading>[0];

    const generatedContent = project.generatedContent as {
      homepage?: {
        hero?: { heading?: string; subheading?: string; ctaText?: string };
        about?: { heading?: string; paragraphs?: string[] };
      };
    };
    const hero = generatedContent.homepage?.hero;
    const about = generatedContent.homepage?.about;
    const appliedModifications: string[] = [];

    if (hero?.heading) {
      const r = replaceHeading(contentTree, hero.heading);
      if (r.success && r.modified) appliedModifications.push(...r.modifications);
    }
    if (hero?.subheading || about?.paragraphs?.[0]) {
      const r = replaceParagraph(contentTree, hero?.subheading || about!.paragraphs![0]);
      if (r.success && r.modified) appliedModifications.push(...r.modifications);
    }
    if (hero?.ctaText) {
      const r = replaceButton(contentTree, hero.ctaText);
      if (r.success && r.modified) appliedModifications.push(...r.modifications);
    }

    const validation = validateElementorJson(contentTree);
    if (!validation.valid) return NextResponse.json({ error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}` }, { status: 422 });

    await prisma.project.update({ where: { id }, data: { elementorData: { version: '0.3', elements: contentTree } as object } });
    return NextResponse.json({ success: true, modifications: appliedModifications });
  } catch (error) {
    console.error('Error applying content:', error);
    return NextResponse.json({ error: 'Failed to apply content' }, { status: 500 });
  }
}
