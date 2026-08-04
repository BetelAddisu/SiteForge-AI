import { NextResponse } from 'next/server';
import { getStorageProvider, STORAGE_BUCKET } from '@/lib/storage';

export async function GET() {
  try {
    console.log('[Debug] STORAGE_BUCKET:', STORAGE_BUCKET);
    console.log('[Debug] R2_ENDPOINT:', process.env.R2_ENDPOINT);
    console.log('[Debug] R2_ACCESS_KEY_ID set:', !!process.env.R2_ACCESS_KEY_ID);

    const provider = await getStorageProvider();
    const files = (await provider.listFiles()).map(f => f.key);

    console.log('[Debug] Files found:', files);

    return NextResponse.json({
      success: true,
      bucket: STORAGE_BUCKET,
      endpoint: process.env.R2_ENDPOINT,
      fileCount: files.length,
      files: files.slice(0, 20), // Limit to first 20
    });
  } catch (error) {
    console.error('[Debug] Storage Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      bucket: STORAGE_BUCKET,
      endpoint: process.env.R2_ENDPOINT,
    }, { status: 500 });
  }
}