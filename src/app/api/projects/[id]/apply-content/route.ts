import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { applyModifications, type ModificationBatch } from '@/lib/elementor/modifier';
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
    if (!template || !template.metadata) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    const templateContent = template.metadata as { content?: unknown[] };
    const contentTree = JSON.parse(JSON.stringify(templateContent.content || [])) as Parameters<typeof applyModifications>[0];

    const generatedContent = project.generatedContent as { homepage?: Record<string, unknown> };
    const modifications: ModificationBatch = { elements: [] };
    if (generatedContent.homepage) {
      modifications.elements.push({ type: 'modify', target: {}, changes: generatedContent.homepage });
    }

    const result = applyModifications(contentTree, modifications);
    if (!result.success) return NextResponse.json({ error: result.error || 'Failed to apply content' }, { status: 500 });

    const validation = validateElementorJson(contentTree);
    if (!validation.valid) return NextResponse.json({ error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}` }, { status: 422 });

    await prisma.project.update({ where: { id }, data: { elementorData: { version: '0.3', elements: contentTree } } });
    return NextResponse.json({ success: true, modifications: result.modifications });
  } catch (error) {
    console.error('Error applying content:', error);
    return NextResponse.json({ error: 'Failed to apply content' }, { status: 500 });
  }
}
