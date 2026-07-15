/**
 * Template Screenshot API
 * 
 * GET /api/templates/screenshot?id={kitSlug-templateSlug}
 * 
 * Fetches screenshot from Supabase storage inside ZIP files
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ManifestTemplate {
  name: string;
  screenshot: string;
  elementor_pro_required: boolean;
}

interface Manifest {
  title: string;
  templates: ManifestTemplate[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all ZIP files in templates bucket
    const { data: files, error } = await supabase.storage
      .from('templates')
      .list('', { limit: 200 });

    if (error || !files) {
      return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }

    const zipFiles = files.filter(f => f.name.endsWith('.zip'));

    // Search for the template in all ZIPs
    for (const zipFile of zipFiles) {
      try {
        const { data: zipData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(zipFile.name);

        if (downloadError || !zipData) continue;

        const arrayBuffer = await zipData.arrayBuffer();
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(arrayBuffer);

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);

        // Parse the template ID to find matching template
        // Format: kitSlug-templateSlug
        for (const template of manifest.templates) {
          const kitSlug = zipFile.name.replace('.zip', '').toLowerCase().replace(/[^\w]/g, '-');
          const templateSlug = template.name.toLowerCase().replace(/[^\w]/g, '-');
          const fullId = `${kitSlug}-${templateSlug}`;

          if (fullId === id.toLowerCase() || fullId.includes(id.toLowerCase())) {
            // Found the template - return screenshot
            const screenshotEntry = zip.file(template.screenshot);
            if (screenshotEntry) {
              const screenshotData = await screenshotEntry.async('nodebuffer');
              
              // Determine content type from extension
              const ext = template.screenshot.split('.').pop()?.toLowerCase() || 'jpg';
              const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

              return new NextResponse(new Uint8Array(screenshotData), {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600',
                },
              });
            }
          }
        }
      } catch (err) {
        console.error(`Error processing ${zipFile.name}:`, err);
      }
    }

    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  } catch (error) {
    console.error('Screenshot API error:', error);
    return NextResponse.json({ error: 'Failed to fetch screenshot' }, { status: 500 });
  }
}
