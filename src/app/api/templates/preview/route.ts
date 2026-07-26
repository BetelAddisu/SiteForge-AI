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
import { listFiles, r2, R2_BUCKET } from '@/lib/storage/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";
import JSZip from 'jszip';
import { renderElementorToHtml, type ElementorNode } from '@/lib/preview/render';

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

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

/**
 * Extract Elementor content from a ZIP file for a specific template
 */
async function extractTemplateContent(
  zipName: string,
  templateSource: string
): Promise<{ elements: ElementorNode[]; name: string } | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: zipName,
    });
    
    const response = await r2.send(command);
    const zipData = await response.Body?.transformToByteArray();
    
    if (!zipData) return null;
    
    const zip = await JSZip.loadAsync(zipData);
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
    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    
    for (const zipName of zipNames) {
      const kitSlug = extractKitSlug(zipName);
      
      // Check if this ZIP matches our template's kit
      if (!templateId.startsWith(kitSlug)) continue;
      
      // Try to find the template in this ZIP's manifest
      try {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();
        
        if (!zipData) continue;
        
        const zip = await JSZip.loadAsync(zipData);
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
            
            // Render the Elementor content to HTML
            const html = renderElementorToHtml(result.elements, {
              title: result.name || template.name,
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
