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

        // Create or find the TemplateKit
        let kitId: string;
        const existingKit = await prisma.templateKit.findUnique({
          where: { slug: kitSlug },
        });

        if (existingKit) {
          kitId = existingKit.id;
        } else {
          const newKit = await prisma.templateKit.create({
            data: {
              name: manifest.title,
              slug: kitSlug,
              industry: detectIndustry(manifest.title),
              style: 'modern',
              templateCount: manifest.templates.length,
              importStatus: 'COMPLETE',
            },
          });
          kitId = newKit.id;
        }

        for (const template of manifest.templates) {
          // Skip Elementor Pro templates
          if (template.elementor_pro_required) continue;

          const templateSlug = slugify(template.name);
          const templateId = `${kitSlug}-${templateSlug}`;

          // Check if already imported with content
          const existing = await prisma.template.findUnique({
            where: { id: templateId },
          });

          // Templates imported before this fix have no `content` in their
          // metadata - backfill them instead of skipping, so a re-run of
          // this endpoint fixes already-imported templates too.
          const existingMetadata = existing?.metadata as { content?: unknown[] } | undefined;
          if (existing && existingMetadata?.content && existingMetadata.content.length > 0) {
            continue;
          }

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

          // Read the actual Elementor page data - this is the widget tree
          // (sections/columns/widgets/settings) the generation pipeline
          // needs to modify. Previously this was never read at all, so
          // every generated site ran against an empty element array.
          let elementorContent: unknown[] = [];
          try {
            const sourceEntry = zip.file(template.source);
            if (sourceEntry) {
              const sourceRaw = await sourceEntry.async('string');
              const parsedSource = JSON.parse(sourceRaw);

              // Elementor export files vary in shape depending on export
              // tool/version - handle the common cases defensively:
              if (Array.isArray(parsedSource)) {
                // Raw array of elements, e.g. straight _elementor_data export
                elementorContent = parsedSource;
              } else if (Array.isArray(parsedSource?.content)) {
                elementorContent = parsedSource.content;
              } else if (Array.isArray(parsedSource?.elements)) {
                elementorContent = parsedSource.elements;
              } else if (Array.isArray(parsedSource?.data)) {
                elementorContent = parsedSource.data;
              } else {
                results.errors.push(
                  `Unrecognized page-data shape for ${template.name} in ${zipFile.name} (source: ${template.source}) - imported without content`
                );
              }
            } else {
              results.errors.push(
                `Source file not found in zip: ${template.source} (${template.name} in ${zipFile.name})`
              );
            }
          } catch (err) {
            results.errors.push(
              `Failed to parse page data for ${template.name} in ${zipFile.name}: ${err}`
            );
          }

          // Create or backfill template in database with R2 storage
          const templateData = {
            name: template.name,
            slug: templateSlug,
            category: detectCategory(template.name),
            industry: detectIndustry(manifest.title),
            style: 'modern',
            storageProvider: 'r2',
            storageKey: zipFile.name, // R2 key is just the filename
            filePath: `templates/${zipFile.name}`, // Legacy path for migration
            previewImage: screenshotUrl ?? existing?.previewImage ?? null,
            kitId: kitId,
            kitSlug: kitSlug,
            kitName: manifest.title,
            metadata: {
              kitName: manifest.title,
              kitSlug,
              source: template.source,
              screenshot: template.screenshot,
              content: elementorContent,
            },
            tags: [kitSlug, detectCategory(template.name)],
            importStatus: (elementorContent.length > 0 ? 'COMPLETE' : 'NEEDS_REVIEW') as 'COMPLETE' | 'NEEDS_REVIEW',
            compatibilityScore: 85,
            compatibilityNotes: {
              greenWidgets: ['heading', 'text-editor', 'image', 'button', 'icon', 'spacer'],
              yellowWidgets: ['container', 'accordion', 'tabs'],
              redWidgets: [],
            },
          };

          await prisma.template.upsert({
            where: { id: templateId },
            create: { id: templateId, ...templateData },
            update: templateData,
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
