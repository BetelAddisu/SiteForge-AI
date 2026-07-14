import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get WordPress connection
    const wpConnection = await prisma.wordPressConnection.findUnique({
      where: { userId: user.id },
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
