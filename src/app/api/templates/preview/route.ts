/**
 * Template Preview API
 * 
 * Renders a template's Elementor JSON content as live HTML.
 * This allows users to see a fully rendered preview of the template
 * with all widgets styled properly, not just a static screenshot.
 * 
 * GET /api/templates/preview?id={templateId}
 *    - Returns rendered HTML for the specified template
 * 
 * Query params:
 *    - id: Template ID (format: {kitSlug}-{templateSlug})
 *    - full: If "true", returns full HTML document; otherwise returns just body content
 */

import { NextResponse } from 'next/server';
import { getStorageProvider } from '@/lib/storage';
import JSZip from 'jszip';
import { renderElementorToHtml, type ElementorNode } from '@/lib/preview/render';
import { getZipFromR2, extractKitSlug, slugify, type Manifest } from '@/lib/templates/manifest';

/**
 * Extract the Global Kit Styles page_settings (system_colors, system_typography,
 * theme-style fields) from the kit's global-styles template so widgets that
 * reference __globals__ resolve to the kit's real colors/fonts.
 */
async function extractGlobalPageSettings(
  zip: typeof JSZip.prototype,
  manifest: Manifest
): Promise<Record<string, unknown> | undefined> {
  const globalTemplate = manifest.templates.find((t) => {
    const tt = t.metadata?.template_type as string | undefined;
    return tt === 'global-styles' || t.name.toLowerCase().includes('global kit');
  });
  if (!globalTemplate) return undefined;

  const entry = zip.file(globalTemplate.source);
  if (!entry) return undefined;

  try {
    const raw = await entry.async('string');
    const json = JSON.parse(raw);
    const pageSettings = json?.page_settings as Record<string, unknown> | undefined;
    return pageSettings || undefined;
  } catch (error) {
    console.error('[Template Preview] Error loading global kit styles:', error);
    return undefined;
  }
}

/**
 * Extract Elementor content from a ZIP file for a specific template
 */
async function extractTemplateContent(
  zipName: string,
  templateSource: string
): Promise<{ elements: ElementorNode[]; name: string } | null> {
  try {
    const zip = await getZipFromR2(zipName);
    if (!zip) return null;

    const templateEntry = zip.file(templateSource);
    
    if (!templateEntry) return null;
    
    const templateRaw = await templateEntry.async('string');
    const pageJson = JSON.parse(templateRaw);
    
    // Extract template name from settings
    let templateName = '';
    if (pageJson?.content?.content?.[0]?.settings?.page_title) {
      templateName = pageJson.content.content[0].settings.page_title;
    }
    
    // Get the elements array - the real structure is pageJson.content.content
    let elements: ElementorNode[] = [];
    if (Array.isArray(pageJson?.content?.content)) {
      elements = pageJson.content.content as ElementorNode[];
    } else if (Array.isArray(pageJson?.content)) {
      elements = pageJson.content as ElementorNode[];
    } else if (Array.isArray(pageJson)) {
      elements = pageJson as ElementorNode[];
    }
    
    return { elements, name: templateName };
  } catch (error) {
    console.error('[Template Preview] Error extracting content:', error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    const full = searchParams.get('full') === 'true';
    
    if (!templateId) {
      return new NextResponse(
        JSON.stringify({ error: 'Template ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Template Preview] Looking for template:', templateId);
    
    // Parse the template ID to get kit and template slugs
    const parts = templateId.split('-');
    
    // Find the ZIP file and extract the template
    const provider = await getStorageProvider();
    const zipFiles = (await provider.listFiles()).map(f => f.key);
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    
    for (const zipName of zipNames) {
      const kitSlug = extractKitSlug(zipName);
      
      // Check if this ZIP matches our template's kit
      if (!templateId.startsWith(kitSlug)) continue;
      
      // Try to find the template in this ZIP's manifest
      try {
        const zip = await getZipFromR2(zipName);
        if (!zip) continue;
        
        const manifestFile = zip.file('manifest.json') || zip.file('kit-manifest.json');
        
        if (!manifestFile) continue;
        
        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        
        // Find the template in this kit
        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          
          const templateSlug = slugify(template.name);
          const expectedId = `${kitSlug}-${templateSlug}`;
          
          if (expectedId === templateId) {
            console.log('[Template Preview] Found template in:', zipName);
            
            // Extract the template content
            const result = await extractTemplateContent(zipName, template.source);
            
            if (!result || result.elements.length === 0) {
              return new NextResponse(
                JSON.stringify({ error: 'Template content not found in archive' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
              );
            }
            
            // Load the kit's Global Kit Styles so __globals__ refs resolve correctly
            const globalPageSettings = await extractGlobalPageSettings(zip, manifest);

            // Render the Elementor content to HTML
            const html = renderElementorToHtml(result.elements, {
              title: result.name || template.name,
              globalKitPageSettings: globalPageSettings,
              brandTokens: {
                colors: {
                  primary: '#2563eb',
                  secondary: '#1e40af',
                  accent: '#06b6d4',
                },
                typography: {
                  headingFont: "'Kanit', system-ui, sans-serif",
                  bodyFont: "'Inter', system-ui, sans-serif",
                },
              },
            });
            
            console.log('[Template Preview] Rendered HTML length:', html.length);
            
            return new NextResponse(html, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
        }
      } catch (error) {
        console.error('[Template Preview] Error processing ZIP:', zipName, error);
        continue;
      }
    }
    
    // Template not found
    return new NextResponse(
      JSON.stringify({ error: `Template not found: ${templateId}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Template Preview] Error:', error);
    return new NextResponse(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
