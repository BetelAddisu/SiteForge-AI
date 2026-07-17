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

// Fetch templates directly from R2
async function fetchTemplatesFromR2() {
  try {
    const zipFiles = await listFiles('');
    const zipNames = zipFiles.filter(f => f.endsWith('.zip'));
    
    const kitMap = new Map<string, any>();
    const templates: any[] = [];
    
    for (const zipName of zipNames) {
      try {
        // Download and parse the ZIP
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: zipName,
        });
        
        const response = await r2.send(command);
        const zipData = await response.Body?.transformToByteArray();
        
        if (!zipData) continue;
        
        const zip = await JSZip.loadAsync(zipData);
        const manifestFile = zip.file('manifest.json');
        
        if (!manifestFile) {
          console.log(`No manifest.json in ${zipName}`);
          continue;
        }
        
        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        
        // Extract kit slug from filename (e.g., "artifice-ai-home.zip" -> kit: "artifice-ai")
        const fileNameWithoutExt = zipName.replace('.zip', '');
        const parts = fileNameWithoutExt.split('-');
        let kitSlug = '';
        let templateSlug = '';
        
        // Find where the template name starts
        for (let i = 0; i < parts.length; i++) {
          const potentialSlug = parts.slice(0, i + 1).join('-');
          const potentialTemplate = parts.slice(i + 1).join('-');
          if (potentialTemplate && manifest.templates.some((t: any) => slugify(t.name).includes(potentialTemplate))) {
            kitSlug = potentialSlug;
            templateSlug = potentialTemplate;
            break;
          }
        }
        
        if (!kitSlug) {
          // Fallback: use first part as kit
          kitSlug = parts[0];
          templateSlug = parts.slice(1).join('-') || fileNameWithoutExt;
        }
        
        // Create or update kit
        if (!kitMap.has(kitSlug)) {
          kitMap.set(kitSlug, {
            id: kitSlug,
            name: manifest.title || kitSlug,
            slug: kitSlug,
            industry: detectIndustry(manifest.title || kitSlug),
            style: 'modern',
            previewImage: null,
            thumbnailImage: null,
            templateCount: 0,
            categories: [],
            templates: [],
          });
        }
        
        const kit = kitMap.get(kitSlug)!;
        
        // Add each template from manifest
        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          
          const templateSlug = slugify(template.name);
          const templateId = `${kitSlug}-${templateSlug}`;
          const category = detectCategory(template.name);
          
          templates.push({
            id: templateId,
            name: template.name,
            slug: templateSlug,
            category,
            industry: kit.industry,
            kitId: kit.id,
            kitName: kit.name,
            kitSlug,
            previewImage: null,
            screenshotUrl: null,
            compatibilityScore: 85,
            storageKey: zipName,
          });
          
          kit.templates.push(templates[templates.length - 1]);
          if (!kit.categories.includes(category)) {
            kit.categories.push(category);
          }
        }
        
        kit.templateCount = kit.templates.length;
        
      } catch (err) {
        console.error(`Error processing ${zipName}:`, err);
      }
    }
    
    return { kits: Array.from(kitMap.values()), templates };
    
  } catch (error) {
    console.error('Error fetching from R2:', error);
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
    
    // Single template by ID
    if (templateId) {
      // Try database first
      const dbTemplate = await prisma.template.findUnique({
        where: { id: templateId },
      });
      
      if (dbTemplate && dbTemplate.storageProvider === 'r2' && dbTemplate.storageKey) {
        const signedUrl = await getSignedDownloadUrl(dbTemplate.storageKey);
        return NextResponse.json({ 
          downloadUrl: signedUrl,
          template: dbTemplate,
        });
      }
      
      // Try to find in R2
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
    
    // Try database first
    const dbTemplates = await prisma.template.findMany({
      where: { importStatus: 'COMPLETE' },
      include: { kit: true },
      orderBy: { name: 'asc' },
    });
    
    const dbKits = await prisma.templateKit.findMany({
      where: { importStatus: 'COMPLETE' },
      include: {
        templates: {
          where: { importStatus: 'COMPLETE' },
          select: { id: true, name: true, slug: true, category: true, previewImage: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    
    // If database has data, use it
    if (dbKits.length > 0 || dbTemplates.length > 0) {
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
    
    // Database empty - fetch from R2 directly
    console.log('Database empty, fetching templates from R2...');
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
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates', kits: [], templates: [], total: 0 }, { status: 500 });
  }
}
