import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Simple encryption for app password
function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, username, appPassword } = body;

    if (!url || !username || !appPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert WordPress connection
    await prisma.wordPressConnection.upsert({
      where: { userId: user.id },
      update: {
        siteUrl: url,
        username,
        appPassword: encrypt(appPassword),
      },
      create: {
        userId: user.id,
        siteUrl: url,
        username,
        appPassword: encrypt(appPassword),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving WordPress connection:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
