import { NextResponse } from 'next/server';
import { getSignedDownloadUrl, listFiles } from '@/lib/storage/r2';
import { getZipFromR2, extractKitSlug, detectCategory, detectIndustry, slugify, type Manifest } from '@/lib/templates/manifest';

// Fetch templates from R2
async function fetchTemplatesFromR2() {
  console.log('[R2] Starting fetch from R2...');
  
  const zipFiles = await listFiles('');
  const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
  console.log(`[R2] Found ${zipNames.length} ZIP files`);
  
  const kitMap = new Map<string, any>();
  const templates: any[] = [];
  
  for (const zipName of zipNames) {
    try {
      console.log(`[R2] Processing: ${zipName}`);
      
      const zip = await getZipFromR2(zipName);
      if (!zip) continue;
      
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) continue;
      
      const manifestContent = await manifestFile.async('string');
      const manifest: Manifest = JSON.parse(manifestContent);
      const kitSlug = extractKitSlug(zipName);
      
      if (!kitMap.has(kitSlug)) {
        // Only use kit thumbnail, not all screenshots
        let kitThumbnail: string | null = null;
        const kitThumb = zip.file('kit-thumbnail.jpg') || zip.file('thumbnail.jpg');
        // Don't load thumbnail as base64 - just store the path reference
        kitThumbnail = null; // Screenshots will be fetched on demand
      
        kitMap.set(kitSlug, {
          id: kitSlug,
          name: manifest.title || kitSlug,
          slug: kitSlug,
          industry: detectIndustry(manifest.title || kitSlug),
          style: 'modern',
          previewImage: kitThumbnail,
          thumbnailImage: kitThumbnail,
          templateCount: 0,
          categories: [],
          templates: [],
          storageKey: zipName,
        });
      }
      
      const kit = kitMap.get(kitSlug)!;
      
      for (const template of manifest.templates) {
        if (template.elementor_pro_required) continue;
        
        const templateSlug = slugify(template.name);
        const templateId = `${kitSlug}-${templateSlug}`;
        const category = detectCategory(template.name);
        
        // Don't load screenshots as base64 - just store screenshot path
        // Screenshots will be loaded on demand when previewing
        
        const templateData = {
          id: templateId,
          name: template.name,
          slug: templateSlug,
          category,
          industry: kit.industry,
          kitId: kit.id,
          kitName: kit.name,
          kitSlug,
          previewImage: null, // Will be fetched on demand
          screenshotUrl: null,
          screenshotPath: template.screenshot, // Store the path in ZIP
          compatibilityScore: 85,
          storageKey: zipName,
        };
        
        templates.push(templateData);
        kit.templates.push(templateData);
        if (!kit.categories.includes(category)) {
          kit.categories.push(category);
        }
      }
      
      kit.templateCount = kit.templates.length;
    } catch (err) {
      console.error(`[R2] Error processing ${zipName}:`, err);
    }
  }
  
  const kits = Array.from(kitMap.values());
  console.log(`[R2] Total: ${kits.length} kits, ${templates.length} templates`);
  
  return { kits, templates };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');
    const kitSlug = searchParams.get('kit');
    const templateId = searchParams.get('id');
    
    // Single template by ID - return download URL
    if (templateId) {
      const { templates } = await fetchTemplatesFromR2();
      const template = templates.find(t => t.id === templateId);
      
      if (template) {
        const signedUrl = await getSignedDownloadUrl(template.storageKey);
        return NextResponse.json({ 
          downloadUrl: signedUrl,
          template,
        });
      }
      
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    // Fetch from R2 directly
    console.log('[Templates] Fetching from R2...');
    const { kits, templates } = await fetchTemplatesFromR2();
    
    // Apply filters
    let filteredTemplates = templates;
    if (category) filteredTemplates = filteredTemplates.filter(t => t.category === category);
    if (industry) filteredTemplates = filteredTemplates.filter(t => t.industry === industry);
    if (kitSlug) filteredTemplates = filteredTemplates.filter(t => t.kitSlug === kitSlug);
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTemplates = filteredTemplates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
        t.category.toLowerCase().includes(searchLower) ||
        t.kitName.toLowerCase().includes(searchLower)
      );
    }
    
    const kitIds = new Set(filteredTemplates.map(t => t.kitId));
    let filteredKits = kits.filter(k => kitIds.has(k.id));
    
    filteredKits = filteredKits.map(kit => ({
      ...kit,
      templates: filteredTemplates.filter((t: any) => t.kitSlug === kit.slug),
      templateCount: filteredTemplates.filter((t: any) => t.kitSlug === kit.slug).length,
    })).filter(kit => kit.templateCount > 0);
    
    return NextResponse.json({ 
      kits: filteredKits, 
      templates: filteredTemplates,
      totalKits: filteredKits.length,
      totalTemplates: filteredTemplates.length,
      source: 'r2',
    });
    
  } catch (error) {
    console.error('[Templates] Error:', error);
    return NextResponse.json({ error: String(error), kits: [], templates: [], total: 0 }, { status: 500 });
  }
}
