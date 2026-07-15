import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('GET /api/settings - Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please sign in to access settings',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    // Get WordPress connection
    const wpConnection = await prisma.wordPressConnection.findUnique({
      where: { supabaseId: user.id },
    });

    return NextResponse.json({
      settings: {
        wordpressUrl: wpConnection?.siteUrl || '',
        wordpressConnected: !!wpConnection,
      },
      apiKeys: {
        gemini: !!process.env.GEMINI_API_KEY,
        unsplash: !!process.env.UNSPLASH_ACCESS_KEY,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
