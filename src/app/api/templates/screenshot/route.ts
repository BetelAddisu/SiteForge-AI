/**
 * Template Screenshot API
 * 
 * GET /api/templates/screenshot?id={kitSlug-templateSlug}
 * 
 * Fetches screenshot from Supabase storage inside ZIP files
 */

import { NextResponse } from 'next/server';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { listFiles, r2, R2_BUCKET } from '@/lib/storage/r2';
import JSZip from 'jszip';

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

    // List all ZIP files in templates bucket
    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));

    if (!zipNames || zipNames.length === 0) {
      return NextResponse.json({ error: 'No files found in R2' }, { status: 404 });
    }

    // Search for the template in all ZIPs
    for (const zipName of zipNames) {
      try {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();

        if (!zipData) continue;

        const zip = await JSZip.loadAsync(zipData);

        let manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
          const allFiles = Object.keys(zip.files);
          const manifestPath = allFiles.find(f => f.endsWith('manifest.json'));
          if (manifestPath) {
            manifestFile = zip.file(manifestPath);
          }
        }
        
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);

        // Parse the template ID to find matching template
        // Format: kitSlug-templateSlug
        for (const template of manifest.templates) {
          const kitSlug = zipName.replace('.zip', '').toLowerCase().replace(/[^\w]/g, '-');
          const templateSlug = template.name.toLowerCase().replace(/[^\w]/g, '-');
          const fullId = `${kitSlug}-${templateSlug}`;

          if (fullId === id.toLowerCase() || fullId.includes(id.toLowerCase())) {
            // Found the template - return screenshot
            // The user noted: inside of the invidual folder with subfolder name screenshots/ as images with indivual page names
            let screenshotEntry: JSZip.JSZipObject | null = null;
            if (template.screenshot) {
              screenshotEntry = zip.file(template.screenshot);
            }
            
            if (!screenshotEntry) {
              // fallback: search inside screenshots/ folder, ignoring root folder prefixes
              const allFiles = Object.keys(zip.files);
              const namePattern = template.name.toLowerCase().replace(/[^a-z0-9]/g, '.*');
              const slugPattern = templateSlug.toLowerCase().replace(/[^a-z0-9]/g, '.*');
              
              const match = allFiles.find(f => {
                const lowerF = f.toLowerCase();
                if (!lowerF.includes('screenshots/')) return false;
                return new RegExp(namePattern).test(lowerF) || new RegExp(slugPattern).test(lowerF);
              });
              
              if (match) {
                screenshotEntry = zip.file(match);
              }
            }

            if (screenshotEntry) {
              const screenshotData = await screenshotEntry.async('nodebuffer');
              
              // Determine content type from extension
              const ext = screenshotEntry.name.split('.').pop()?.toLowerCase() || 'jpg';
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
        console.error(`Error processing ${zipName}:`, err);
      }
    }

    return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
  } catch (error) {
    console.error('Screenshot API error:', error);
    return NextResponse.json({ error: 'Failed to fetch screenshot' }, { status: 500 });
  }
}
