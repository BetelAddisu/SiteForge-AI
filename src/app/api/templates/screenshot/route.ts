/**
 * Template Screenshot API
 * 
 * GET /api/templates/screenshot?kit={kitSlug}&screenshot={screenshotPath}
 * 
 * Fetches screenshot from R2 inside ZIP files
 */

import { NextResponse } from 'next/server';
import { listFiles } from '@/lib/storage/r2';
import { getZipFromR2, extractKitSlug, slugify, type Manifest } from '@/lib/templates/manifest';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kit = searchParams.get('kit');
    const screenshot = searchParams.get('screenshot');
    const id = searchParams.get('id');

    if (!kit && !id) {
      return NextResponse.json({ error: 'Template kit or ID required' }, { status: 400 });
    }

    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));

    let targetZip: string | null = null;
    let targetScreenshot: string | null = null;

    if (kit) {
      for (const zipName of zipNames) {
        const kitSlug = extractKitSlug(zipName);
        if (kitSlug === kit) {
          const zip = await getZipFromR2(zipName);
          if (zip && screenshot) {
            const screenshotFile = zip.file(screenshot);
            if (screenshotFile) {
              targetZip = zipName;
              targetScreenshot = screenshot;
              break;
            }
          }
        }
      }
      
      if (!targetScreenshot && kit) {
        for (const zipName of zipNames) {
          const kitSlug = extractKitSlug(zipName);
          if (kitSlug === kit) {
            const zip = await getZipFromR2(zipName);
            if (zip) {
              const defaultShot = zip.file('screenshots/global-kit-styles.jpg') || 
                                zip.file('screenshots/home.jpg');
              if (defaultShot) {
                targetZip = zipName;
                targetScreenshot = defaultShot.name;
                break;
              }
            }
          }
        }
      }
    }

    if (!targetZip && id) {
      for (const zipName of zipNames) {
        const zip = await getZipFromR2(zipName);
        if (!zip) continue;

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = extractKitSlug(zipName);

        for (const template of manifest.templates) {
          const templateSlug = slugify(template.name);
          const fullId = `${kitSlug}-${templateSlug}`;

          if (fullId === id.toLowerCase() || fullId.includes(id.toLowerCase())) {
            targetZip = zipName;
            targetScreenshot = template.screenshot;
            break;
          }
        }
        
        if (targetZip) break;
      }
    }

    if (!targetZip || !targetScreenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 });
    }

    const zip = await getZipFromR2(targetZip);
    if (!zip) {
      return NextResponse.json({ error: 'Failed to load ZIP' }, { status: 500 });
    }

    const screenshotEntry = zip.file(targetScreenshot);
    if (!screenshotEntry) {
      return NextResponse.json({ error: 'Screenshot not found in ZIP' }, { status: 404 });
    }

    const screenshotData = await screenshotEntry.async('nodebuffer');
    const ext = targetScreenshot.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

    return new NextResponse(new Uint8Array(screenshotData), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Screenshot] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch screenshot' }, { status: 500 });
  }
}
