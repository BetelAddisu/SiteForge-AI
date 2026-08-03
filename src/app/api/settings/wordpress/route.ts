import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/database/server-supabase';
import { saveWordPressConnection } from '@/lib/wordpress';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { url, username, appPassword } = body;

    if (!url || !username || !appPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save using the same helper the publish path reads from, keyed by the
    // Prisma user id (the settings GET and publish route both look it up that way)
    await saveWordPressConnection(appUser.id, url, username, appPassword);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving WordPress connection:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
