import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { publishToWordPress, getWordPressConnection } from '@/lib/wordpress';

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

    const connection = await getWordPressConnection(appUser.id);
    if (!connection) return NextResponse.json({ error: 'No WordPress site connected. Add your WordPress details in Settings first.' }, { status: 400 });

    const elementorData = project.elementorData as { elements?: unknown[] };
    const slug = project.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = await publishToWordPress(appUser.id, id, [
      { title: project.businessName, slug, elementorData: elementorData.elements ?? [], status: 'publish' },
    ]);

    if (!result.success) return NextResponse.json({ error: result.errors?.join('; ') || 'Publish failed' }, { status: 502 });

    await prisma.project.update({ where: { id }, data: { status: 'PUBLISHED' } });
    return NextResponse.json({ success: true, publishedPages: result.publishedPages });
  } catch (error) {
    console.error('Error publishing to WordPress:', error);
    return NextResponse.json({ error: 'Failed to publish to WordPress' }, { status: 500 });
  }
}
