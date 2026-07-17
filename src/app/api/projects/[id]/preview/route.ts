import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { generatePreview } from '@/lib/preview';

async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
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
    if (!project.elementorData) return NextResponse.json({ error: 'No generated content yet. Generate the website first.' }, { status: 400 });

    const elementorData = project.elementorData as { elements?: unknown[] };
    const brandTokens = project.brandTokens as { colors?: { primary?: string; secondary?: string }; typography?: { headingFont?: string; bodyFont?: string } } | undefined;

    const result = await generatePreview({
      projectId: id,
      elementorData: elementorData.elements ?? [],
      stylePreset: project.stylePreset ?? undefined,
      brandTokens,
    });

    if (!result.success) return NextResponse.json({ error: result.error || 'Preview generation failed' }, { status: 500 });
    return NextResponse.json({ success: true, previewUrl: result.previewUrl });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  }
}
