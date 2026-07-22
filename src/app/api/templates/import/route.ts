/**
 * Template Import API
 * 
 * Imports templates from R2 storage to database.
 * Call this once to populate the database with all templates.
 * This makes templates available to the generation pipeline.
 * 
 * POST /api/templates/import
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listFiles, r2, R2_BUCKET } from '@/lib/storage/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import JSZip from 'jszip';

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

function extractKitSlug(filename: string): string {
  const withoutExt = filename.replace('.zip', '');
  const withoutTimestamp = withoutExt.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-utc$/, '');
  const cleanName = withoutTimestamp
    .replace(/-elementor-template-kit$/i, '')
    .replace(/-elementor-pro-template-kit$/i, '')
    .replace(/-woocommerce-el$/i, '')
    .replace(/-wordpress-theme$/i, '')
    .replace(/-full$/i, '');
  return cleanName;
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
    console.log('[Import] Starting template import from R2...');
    
    // List all ZIP files from R2
    const zipNames = await listFiles('');
    const zipFiles = zipNames.filter(f => f.endsWith('.zip'));
    
    console.log(`[Import] Found ${zipFiles.length} ZIP files in R2`);
    
    const results = {
      kitsFound: zipFiles.length,
      templatesImported: 0,
      errors: [] as string[],
    };

    for (const zipName of zipFiles) {
      try {
        console.log(`[Import] Processing: ${zipName}`);
        
        // Download ZIP from R2
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();
        
        if (!zipData) {
          results.errors.push(`Failed to download: ${zipName}`);
          continue;
        }
        
        const zip = await JSZip.loadAsync(zipData);

        // Find manifest - real kits use kit-manifest.json
        const manifestFile = zip.file('kit-manifest.json') || zip.file('manifest.json');
        if (!manifestFile) {
          results.errors.push(`No manifest in: ${zipName}`);
          continue;
        }

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        // Use extractKitSlug to match the same logic as the templates listing API
        const kitSlug = extractKitSlug(zipName);

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
              name: manifest.title || kitSlug,
              slug: kitSlug,
              industry: detectIndustry(manifest.title || kitSlug),
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

          // Check if already has sections (means it was properly imported)
          const existingSections = await prisma.templateSection.findFirst({
            where: { templateId: templateId },
          });
          
          if (existing && existingSections) {
            console.log(`[Import] Skipping already imported: ${templateId}`);
            continue;
          }

          // Read the actual Elementor page data - the widget tree lives at
          // pageJson.content.content (double nested in the real format).
          // Also resolve template name from the JSON's page_title setting.
          let elementorContent: object[] = [];
          let templateName = template.name;
          
          try {
            const sourceEntry = zip.file(template.source);
            if (sourceEntry) {
              const sourceRaw = await sourceEntry.async('string');
              const pageJson = JSON.parse(sourceRaw);

              // Extract template name from page_title if available
              if (pageJson?.content?.content?.[0]?.settings?.page_title) {
                templateName = pageJson.content.content[0].settings.page_title;
              }

              // Real structure: pageJson.content.content is the widget array
              if (Array.isArray(pageJson?.content?.content)) {
                elementorContent = pageJson.content.content as object[];
              } else if (Array.isArray(pageJson?.content)) {
                elementorContent = pageJson.content as object[];
              } else if (Array.isArray(pageJson)) {
                elementorContent = pageJson as object[];
              } else {
                results.errors.push(
                  `Unrecognized page-data shape for ${template.name} in ${zipName} (source: ${template.source})`
                );
              }
            } else {
              results.errors.push(
                `Source file not found in zip: ${template.source} (${template.name} in ${zipName})`
              );
            }
          } catch (err) {
            results.errors.push(
              `Failed to parse page data for ${template.name} in ${zipName}: ${err}`
            );
          }

          // Create or backfill template in database with R2 storage
          // Use resolved templateName and category from manifest if available
          const resolvedSlug = slugify(templateName);
          const resolvedCategory = detectCategory(templateName);
          
          const templateData = {
            name: templateName,
            slug: resolvedSlug,
            category: resolvedCategory,
            industry: detectIndustry(manifest.title || kitSlug),
            style: 'modern',
            storageProvider: 'r2',
            storageKey: zipName,
            filePath: zipName,
            previewImage: existing?.previewImage ?? null,
            kitId: kitId,
            kitSlug: kitSlug,
            kitName: manifest.title || kitSlug,
            metadata: {
              kitName: manifest.title,
              kitSlug,
              source: template.source,
              content: elementorContent,
            },
            tags: [kitSlug, resolvedCategory],
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

          // Create TemplateSection records from the Elementor content
          // The generation pipeline reads from TemplateSection.content and needs
          // the full element tree for widget traversal (replaceHeading, etc.)
          // Store all elements as a single section containing the full tree
          if (elementorContent.length > 0) {
            // Delete existing sections for this template (in case of re-import)
            await prisma.templateSection.deleteMany({
              where: { templateId: templateId },
            });

            // Create a single section containing the entire element tree
            const sectionType = detectCategory(templateName);
            await prisma.templateSection.create({
              data: {
                templateId: templateId,
                type: sectionType,
                title: templateName,
                content: elementorContent as object[],
                metadata: {
                  elementCount: elementorContent.length,
                },
              },
            });
          }

          results.templatesImported++;
        }
      } catch (err) {
        results.errors.push(`Error processing ${zipName}: ${err}`);
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
