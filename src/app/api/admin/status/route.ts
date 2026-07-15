/**
 * Admin Status API
 * 
 * GET /api/admin/status - Get system health status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET() {
  const status: {
    database: { connected: boolean; error: string | null };
    supabaseStorage: { connected: boolean; error: string | null; bucketExists: boolean };
    geminiApi: { configured: boolean };
    unsplashApi: { configured: boolean };
    wordpress: { configured: boolean };
    healthy: boolean;
    timestamp: string;
  } = {
    database: { connected: false, error: null },
    supabaseStorage: { connected: false, error: null, bucketExists: false },
    geminiApi: { configured: false },
    unsplashApi: { configured: false },
    wordpress: { configured: false },
    healthy: false,
    timestamp: new Date().toISOString(),
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    status.database.connected = true;
  } catch (error) {
    status.database.error = String(error);
  }

  // Check Supabase storage
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabase.storage.listBuckets();
      
      if (!error && data) {
        status.supabaseStorage.connected = true;
        const templatesBucket = data.find(b => b.name === 'templates');
        status.supabaseStorage.bucketExists = !!templatesBucket;
      } else {
        status.supabaseStorage.error = error?.message || 'Failed to list buckets';
      }
    } catch (error) {
      status.supabaseStorage.error = String(error);
    }
  }

  // Check API keys (these are server-side only, not exposed to client)
  status.geminiApi.configured = !!process.env.GEMINI_API_KEY;
  status.unsplashApi.configured = !!process.env.UNSPLASH_ACCESS_KEY;

  // Check WordPress configuration
  try {
    const wordpressConfig = await prisma.wordPressConnection.findFirst();
    status.wordpress.configured = !!wordpressConfig;
  } catch {
    status.wordpress.configured = false;
  }

  // Calculate overall health
  status.healthy = 
    status.database.connected && 
    status.supabaseStorage.connected &&
    status.geminiApi.configured;

  return NextResponse.json(status);
}
