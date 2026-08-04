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
import { getStorageProvider } from '@/lib/storage';
import { getZipFromR2, extractKitSlug, detectCategory, detectIndustry, slugify, type Manifest } from '@/lib/templates/manifest';

export async function POST(request: Request) {
  try {
    console.log('[Import] Starting template import from storage...');
    
    // List all ZIP files from the configured storage
    const provider = await getStorageProvider();
    const listed = (await provider.listFiles()).map(f => f.key);
    const zipFiles = listed.filter(f => f.endsWith('.zip'));
    
    console.log(`[Import] Found ${zipFiles.length} ZIP files in storage`);
    
    const results = {
      kitsFound: zipFiles.length,
      templatesImported: 0,
      errors: [] as string[],
    };

    for (const zipName of zipFiles) {
      try {
        console.log(`[Import] Processing: ${zipName}`);
        
        const zip = await getZipFromR2(zipName);
        if (!zip) {
          results.errors.push(`Failed to download: ${zipName}`);
          continue;
        }

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
