import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl, listFiles, r2, R2_BUCKET } from '@/lib/storage/r2';
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
  if (name.includes('off-canvas') || name.includes('offcanvas')) return 'offcanvas';
  if (name.includes('form')) return 'form';
  if (name.includes('blog') || name.includes('post')) return 'blog';
  if (name.includes('404')) return 'error';
  return 'section';
}

function detectIndustry(kitName: string): string | null {
  const name = kitName.toLowerCase();
  const industries: [string, string][] = [
    ['wine', 'Restaurant'], ['restaurant', 'Restaurant'], ['cafe', 'Restaurant'], ['food', 'Restaurant'],
    ['digital', 'Technology'], ['tech', 'Technology'], ['ai', 'Technology'], ['robotics', 'Technology'],
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
    ['architecture', 'Architecture'], ['interior', 'Architecture'],
    ['fashion', 'Fashion'], ['beauty', 'Fashion'],
  ];
  for (const [key, value] of industries) {
    if (name.includes(key)) return value;
  }
  return null;
}

// Extract kit name from filename (remove timestamp and extension)
function extractKitSlug(filename: string): string {
  // Filename format: "kit-name-2023-11-27-05-19-42-utc.zip"
  // or: "kit-name-full-elementor-template-kit.zip"
  const withoutExt = filename.replace('.zip', '');
  
  // Remove timestamp pattern: -YYYY-MM-DD-HH-MM-SS-utc
  const withoutTimestamp = withoutExt.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-utc$/, '');
  
  // Remove common suffixes
  const cleanName = withoutTimestamp
    .replace(/-elementor-template-kit$/i, '')
    .replace(/-elementor-pro-template-kit$/i, '')
    .replace(/-woocommerce-el$/i, '')
    .replace(/-wordpress-theme$/i, '')
    .replace(/-full$/i, '');
  
  return cleanName;
}

// Fetch templates directly from R2 by extracting ZIP files
async function fetchTemplatesFromR2() {
  console.log('[R2] Starting fetch from R2...');
  
  try {
    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    console.log(`[R2] Found ${zipNames.length} ZIP files`);
    
    const kitMap = new Map<string, any>();
    const templates: any[] = [];
    
    for (const zipName of zipNames) {
      try {
        console.log(`[R2] Processing: ${zipName}`);
        
        // Download ZIP from R2
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();
        
        if (!zipData) {
          console.log(`[R2] No data for ${zipName}`);
          continue;
        }
        
        // Load and extract ZIP
        const zip = await JSZip.loadAsync(zipData);
        
        // Find manifest.json
        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) {
          console.log(`[R2] No manifest.json in ${zipName}`);
          continue;
        }
        
        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        
        // Extract kit slug from filename
        const kitSlug = extractKitSlug(zipName);
        console.log(`[R2] Kit: ${kitSlug}, Templates: ${manifest.templates.length}`);
        
        // Create or update kit
        if (!kitMap.has(kitSlug)) {
          // Check for kit thumbnail in the ZIP
          let kitThumbnail: string | null = null;
          const thumbnailFile = zip.file('kit-thumbnail.jpg') || zip.file('thumbnail.jpg') || zip.file('preview.jpg');
          if (thumbnailFile) {
            const thumbnailData = await thumbnailFile.async('base64');
            kitThumbnail = `data:image/jpeg;base64,${thumbnailData}`;
          }
          
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
        
        // Process each template in the manifest
        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          
          const templateSlug = slugify(template.name);
          const templateId = `${kitSlug}-${templateSlug}`;
          const category = detectCategory(template.name);
          
          // Look for screenshot in the ZIP
          let screenshotUrl: string | null = null;
          if (template.screenshot) {
            const screenshotFile = zip.file(template.screenshot);
            if (screenshotFile) {
              const screenshotData = await screenshotFile.async('base64');
              const ext = template.screenshot.split('.').pop() || 'jpg';
              screenshotUrl = `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${screenshotData}`;
            }
          }
          
          const templateData = {
            id: templateId,
            name: template.name,
            slug: templateSlug,
            category,
            industry: kit.industry,
            kitId: kit.id,
            kitName: kit.name,
            kitSlug,
            previewImage: screenshotUrl,
            screenshotUrl,
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
        console.log(`[R2] Added ${kit.templates.length} templates for kit: ${kit.name}`);
        
      } catch (err) {
        console.error(`[R2] Error processing ${zipName}:`, err);
      }
    }
    
    const kits = Array.from(kitMap.values());
    console.log(`[R2] Total: ${kits.length} kits, ${templates.length} templates`);
    
    return { kits, templates };
    
  } catch (error) {
    console.error('[R2] Error fetching from R2:', error);
    return { kits: [], templates: [] };
  }
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
    
    // Try database first, but don't fail if it's unavailable
    let dbKits: any[] = [];
    let dbTemplates: any[] = [];
    
    try {
      dbTemplates = await prisma.template.findMany({
        where: { importStatus: 'COMPLETE' },
        include: { kit: true },
        orderBy: { name: 'asc' },
      });
      
      dbKits = await prisma.templateKit.findMany({
        where: { importStatus: 'COMPLETE' },
        include: {
          templates: {
            where: { importStatus: 'COMPLETE' },
            select: { id: true, name: true, slug: true, category: true, previewImage: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    } catch (dbError) {
      console.log('[Templates] Database not available, using R2:', dbError);
    }
    
    // If database has data, use it
    if (dbKits.length > 0 || dbTemplates.length > 0) {
      console.log('[Templates] Using database data:', dbKits.length, 'kits,', dbTemplates.length, 'templates');
      let filteredTemplates = dbTemplates;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTemplates = dbTemplates.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
          t.category.toLowerCase().includes(searchLower) ||
          (t.kitName && t.kitName.toLowerCase().includes(searchLower))
        );
      }
      
      const kitIds = new Set(filteredTemplates.map(t => t.kitId));
      let filteredKits = dbKits.filter(k => kitIds.has(k.id));
      
      filteredKits = filteredKits.map(kit => ({
        ...kit,
        templates: filteredTemplates.filter((t: any) => t.kitId === kit.id),
        templateCount: filteredTemplates.filter((t: any) => t.kitId === kit.id).length,
      }));
      
      return NextResponse.json({ 
        kits: filteredKits, 
        templates: filteredTemplates,
        totalKits: filteredKits.length,
        totalTemplates: filteredTemplates.length,
        source: 'database',
      });
    }
    
    // Database empty or unavailable - fetch from R2
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
    return NextResponse.json({ error: 'Failed to fetch templates', kits: [], templates: [], total: 0 }, { status: 500 });
  }
}
