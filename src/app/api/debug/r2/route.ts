import { NextResponse } from 'next/server';
import { listFiles, R2_BUCKET } from '@/lib/storage/r2';

export async function GET() {
  try {
    console.log('[Debug] R2_BUCKET:', R2_BUCKET);
    console.log('[Debug] R2_ENDPOINT:', process.env.R2_ENDPOINT);
    console.log('[Debug] R2_ACCESS_KEY_ID set:', !!process.env.R2_ACCESS_KEY_ID);
    
    const files = await listFiles('');
    
    console.log('[Debug] Files found:', files);
    
    return NextResponse.json({
      success: true,
      bucket: R2_BUCKET,
      endpoint: process.env.R2_ENDPOINT,
      fileCount: files.length,
      files: files.slice(0, 20), // Limit to first 20
    });
  } catch (error) {
    console.error('[Debug] R2 Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      bucket: R2_BUCKET,
      endpoint: process.env.R2_ENDPOINT,
    }, { status: 500 });
  }
}
