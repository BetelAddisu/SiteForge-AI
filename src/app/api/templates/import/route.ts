/**
 * Template Import API
 * 
 * Imports templates from Supabase storage to database.
 * Call this once to populate the database with all templates.
 * 
 * POST /api/templates/import
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface ManifestTemplate {
  name: string;
  screenshot: string;
  source: string;
  type: string;
  metadata?: Record<string, unknown>;
  elementor_pro_required: boolean;
}

interface Manifest {
  manifest_version: string;
  title: string;
  templates: ManifestTemplate[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function detectCategory(templateName: string): string {
  const name = templateName.toLowerCase();
  if (name.includes('hero') || name.includes('home') || name.includes('banner')) return 'hero';
  if (name.includes('about') || name.includes('who')) return 'about';
  if (name.includes('service')) return 'services';
  if (name.includes('pricing') || name.includes('price')) return 'pricing';
  if (name.includes('team')) return 'team';
  if (name.includes('testimonial') || name.includes('review')) return 'testimonial';
  if (name.includes('faq')) return 'faq';
  if (name.includes('contact')) return 'contact';
  if (name.includes('header')) return 'header';
  if (name.includes('footer')) return 'footer';
  if (name.includes('product')) return 'product';
  if (name.includes('404')) return 'error';
  return 'section';
}

function detectIndustry(kitName: string): string | null {
  const name = kitName.toLowerCase();
  const industries: [string, string][] = [
    ['wine', 'Restaurant'], ['restaurant', 'Restaurant'], ['cafe', 'Restaurant'], ['food', 'Restaurant'],
    ['digital', 'Technology'], ['tech', 'Technology'],
    ['marketing', 'Marketing'], ['agency', 'Marketing'],
    ['medical', 'Healthcare'], ['health', 'Healthcare'],
    ['fitness', 'Fitness'], ['gym', 'Fitness'],
    ['real estate', 'Real Estate'], ['property', 'Real Estate'],
    ['legal', 'Legal'], ['law', 'Legal'],
    ['finance', 'Finance'], ['financial', 'Finance'],
    ['travel', 'Travel'], ['hotel', 'Travel'],
    ['education', 'Education'],
    ['nonprofit', 'Non-Profit'], ['charity', 'Non-Profit'],
    ['ecommerce', 'E-commerce'], ['shop', 'E-commerce'],
    ['creative', 'Creative'], ['portfolio', 'Creative'],
  ];
  for (const [key, value] of industries) {
    if (name.includes(key)) return value;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    
    // List all ZIP files
    const { data: files, error } = await supabase.storage
      .from('templates')
      .list('', { limit: 200 });

    if (error || !files) {
      return NextResponse.json(
        { error: 'Failed to list templates bucket', details: error },
        { status: 500 }
      );
    }

    const zipFiles = files.filter(f => f.name.endsWith('.zip'));
    
    const results = {
      kitsFound: zipFiles.length,
      templatesImported: 0,
      screenshotsUploaded: 0,
      errors: [] as string[],
    };

    for (const zipFile of zipFiles) {
      try {
        // Download ZIP
        const { data: zipData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(zipFile.name);

        if (downloadError || !zipData) {
          results.errors.push(`Failed to download: ${zipFile.name}`);
          continue;
        }

        const arrayBuffer = await zipData.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Find manifest
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
          results.errors.push(`No manifest in: ${zipFile.name}`);
          continue;
        }

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = slugify(manifest.title);

        for (const template of manifest.templates) {
          // Skip Elementor Pro templates
          if (template.elementor_pro_required) continue;

          const templateSlug = slugify(template.name);
          const templateId = `${kitSlug}-${templateSlug}`;

          // Check if already imported
          const existing = await prisma.template.findUnique({
            where: { id: templateId },
          });

          if (existing) continue;

          // Upload screenshot
          let screenshotUrl: string | null = null;
          try {
            const screenshotEntry = zip.file(template.screenshot);
            if (screenshotEntry) {
              const screenshotData = await screenshotEntry.async('nodebuffer');
              const fileName = `${kitSlug}/${templateSlug}.jpg`;
              
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('template-screenshots')
                .upload(fileName, screenshotData, {
                  contentType: 'image/jpeg',
                  upsert: true,
                });

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('template-screenshots')
                  .getPublicUrl(fileName);
                screenshotUrl = urlData.publicUrl;
                results.screenshotsUploaded++;
              }
            }
          } catch {
            // Screenshot upload failed
          }

          // Create template in database
          await prisma.template.create({
            data: {
              id: templateId,
              name: template.name,
              category: detectCategory(template.name),
              industry: detectIndustry(manifest.title),
              style: 'modern',
              filePath: `templates/${zipFile.name}`,
              previewImage: screenshotUrl,
              metadata: {
                kitName: manifest.title,
                kitSlug,
                source: template.source,
                screenshot: template.screenshot,
              },
              tags: [kitSlug, detectCategory(template.name)],
              importStatus: 'COMPLETE',
              compatibilityScore: 85,
              compatibilityNotes: {
                greenWidgets: ['heading', 'text-editor', 'image', 'button', 'icon', 'spacer'],
                yellowWidgets: ['container', 'accordion', 'tabs'],
                redWidgets: [],
              },
            },
          });

          results.templatesImported++;
        }
      } catch (err) {
        results.errors.push(`Error processing ${zipFile.name}: ${err}`);
      }
    }

    // Get total count
    const totalCount = await prisma.template.count();

    return NextResponse.json({
      success: true,
      results,
      totalInDatabase: totalCount,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: String(error) },
      { status: 500 }
    );
  }
}
