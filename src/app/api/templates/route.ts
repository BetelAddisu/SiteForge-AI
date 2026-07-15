import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Template kit interface (grouped templates)
interface TemplateKit {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  style: string | null;
  previewImage: string | null;
  thumbnailImage: string | null;
  templateCount: number;
  categories: string[];
  templates: TemplateItem[];
}

// Individual template interface
interface TemplateItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  industry: string | null;
  kitId: string;
  kitName: string;
  kitSlug: string;
  previewImage: string | null;
  screenshotUrl: string | null;
  compatibilityScore: number;
}

// Cached templates
interface CachedData {
  kits: TemplateKit[];
  templates: TemplateItem[];
  updatedAt: number;
}

let dataCache: CachedData | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

async function fetchTemplatesFromDatabase(): Promise<{ kits: TemplateKit[]; templates: TemplateItem[] } | null> {
  try {
    // Try to fetch from TemplateKit model first (new structure)
    const templateKits = await prisma.templateKit.findMany({
      where: { importStatus: 'COMPLETE' },
      include: {
        templates: {
          where: { importStatus: 'COMPLETE' },
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            industry: true,
            previewImage: true,
            compatibilityScore: true,
            metadata: true,
          },
        },
      },
    });

    if (templateKits.length > 0) {
      const kits: TemplateKit[] = templateKits.map(kit => ({
        id: kit.id,
        name: kit.name,
        slug: kit.slug,
        industry: kit.industry,
        style: kit.style,
        previewImage: kit.previewImage,
        thumbnailImage: kit.thumbnailImage,
        templateCount: kit.templateCount,
        categories: kit.categories,
        templates: kit.templates.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          category: t.category,
          industry: t.industry,
          kitId: kit.id,
          kitName: kit.name,
          kitSlug: kit.slug,
          previewImage: t.previewImage,
          screenshotUrl: t.previewImage,
          compatibilityScore: t.compatibilityScore || 85,
        })),
      }));

      const templates: TemplateItem[] = kits.flatMap(kit => kit.templates);
      return { kits, templates };
    }

    // Fall back to old Template model structure
    const templates = await prisma.template.findMany({
      where: { importStatus: 'COMPLETE' },
      select: {
        id: true,
        name: true,
        category: true,
        industry: true,
        previewImage: true,
        compatibilityScore: true,
        metadata: true,
      },
    });

    const items: TemplateItem[] = templates.map(t => ({
      id: t.id,
      name: t.name,
      slug: slugify(t.name),
      category: t.category,
      industry: t.industry,
      kitId: (t.metadata as { kitId?: string })?.kitId || '',
      kitName: (t.metadata as { kitName?: string })?.kitName || '',
      kitSlug: (t.metadata as { kitSlug?: string })?.kitSlug || '',
      previewImage: t.previewImage,
      screenshotUrl: t.previewImage,
      compatibilityScore: t.compatibilityScore || 85,
    }));

    // Group by kit
    const kitMap = new Map<string, TemplateKit>();
    const groupedTemplates: TemplateItem[] = [];

    for (const item of items) {
      const kitId = item.kitSlug || 'uncategorized';
      const kitName = item.kitName || 'Uncategorized';

      if (!kitMap.has(kitId)) {
        kitMap.set(kitId, {
          id: kitId,
          name: kitName,
          slug: kitId,
          industry: detectIndustry(kitName),
          style: null,
          previewImage: item.previewImage,
          thumbnailImage: null,
          templateCount: 0,
          categories: [],
          templates: [],
        });
      }

      const kit = kitMap.get(kitId)!;
      kit.templates.push(item);
      kit.templateCount = kit.templates.length;
      if (!kit.categories.includes(item.category)) {
        kit.categories.push(item.category);
      }
      groupedTemplates.push(item);
    }

    return { kits: Array.from(kitMap.values()), templates: groupedTemplates };
  } catch (error) {
    console.log('Database not available, falling back to Supabase storage');
    console.error('Database error:', error);
    return null;
  }
}

async function fetchTemplatesFromSupabase(): Promise<{ kits: TemplateKit[]; templates: TemplateItem[] }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Supabase not configured');
    return { kits: [], templates: [] };
  }

  const supabase = getSupabaseAdmin();
  const templates: TemplateItem[] = [];
  const kitMap = new Map<string, TemplateKit>();

  try {
    const { data: files, error } = await supabase.storage.from('templates').list('', { limit: 200 });
    if (error || !files) {
      console.error('Error listing templates bucket:', error);
      return { kits: [], templates: [] };
    }

    const zipFiles = files.filter(f => f.name.endsWith('.zip'));
    console.log(`Found ${zipFiles.length} ZIP files in templates bucket`);

    for (const zipFile of zipFiles) {
      try {
        const { data: zipData, error: downloadError } = await supabase.storage.from('templates').download(zipFile.name);
        if (downloadError || !zipData) continue;

        const arrayBuffer = await zipData.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = slugify(manifest.title);
        const industry = detectIndustry(manifest.title);

        // Create or get kit
        if (!kitMap.has(kitSlug)) {
          // Try to get kit thumbnail from screenshots bucket
          let kitThumbnail: string | null = null;
          try {
            const { data: thumbData } = supabase.storage.from('template-screenshots').getPublicUrl(`${kitSlug}/kit-thumbnail.jpg`);
            if (thumbData?.publicUrl && !thumbData.publicUrl.includes('localhost')) {
              kitThumbnail = thumbData.publicUrl;
            }
          } catch {}

          kitMap.set(kitSlug, {
            id: kitSlug,
            name: manifest.title,
            slug: kitSlug,
            industry,
            style: null,
            previewImage: kitThumbnail,
            thumbnailImage: kitThumbnail,
            templateCount: 0,
            categories: [],
            templates: [],
          });
        }

        const kit = kitMap.get(kitSlug)!;

        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          const templateSlug = slugify(template.name);
          const category = detectCategory(template.name);

          // Use our screenshot API endpoint
          const templateId = `${kitSlug}-${templateSlug}`;
          const screenshotUrl = `/api/templates/screenshot?id=${templateId}`;

          // Try to get screenshot from template-screenshots bucket
          let previewImage: string | null = null;
          try {
            const screenshotPath = `${kitSlug}/${templateSlug}.jpg`;
            const { data: screenshotData } = supabase.storage.from('template-screenshots').getPublicUrl(screenshotPath);
            if (screenshotData.publicUrl && !screenshotData.publicUrl.includes('localhost')) {
              previewImage = screenshotData.publicUrl;
            }
          } catch {}

          const templateItem: TemplateItem = {
            id: templateId,
            name: template.name,
            slug: templateSlug,
            category,
            industry,
            kitId: kitSlug,
            kitName: manifest.title,
            kitSlug,
            previewImage: previewImage || screenshotUrl,
            screenshotUrl,
            compatibilityScore: 85,
          };

          templates.push(templateItem);
          kit.templates.push(templateItem);
          if (!kit.categories.includes(category)) {
            kit.categories.push(category);
          }
        }

        kit.templateCount = kit.templates.length;
      } catch (err) {
        console.error(`Error processing ${zipFile.name}:`, err);
      }
    }
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
  }

  return { kits: Array.from(kitMap.values()), templates };
}

async function getData() {
  const now = Date.now();
  
  // Check cache first
  if (dataCache && (now - dataCache.updatedAt) < CACHE_TTL) {
    return dataCache;
  }

  // Try database first
  const dbData = await fetchTemplatesFromDatabase();
  if (dbData && (dbData.kits.length > 0 || dbData.templates.length > 0)) {
    dataCache = { ...dbData, updatedAt: now };
    return dataCache;
  }

  // Fall back to Supabase storage
  const data = await fetchTemplatesFromSupabase();
  dataCache = { ...data, updatedAt: now };
  return dataCache;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');
    const kitSlug = searchParams.get('kit');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const groupByKit = searchParams.get('groupByKit') !== 'false'; // Default to true

    if (forceRefresh) dataCache = null;

    const { kits, templates } = await getData();

    // Filter templates
    let filteredTemplates = [...templates];
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

    // Filter kits based on templates they contain
    const kitIds = new Set(filteredTemplates.map(t => t.kitId));
    let filteredKits = kits.filter(k => kitIds.has(k.id));

    // Apply kit-level filters
    if (industry) filteredKits = filteredKits.filter(k => k.industry === industry);
    if (search) {
      const searchLower = search.toLowerCase();
      filteredKits = filteredKits.filter(k => 
        k.name.toLowerCase().includes(searchLower) ||
        (k.industry && k.industry.toLowerCase().includes(searchLower))
      );
    }

    // Update kits to only include their filtered templates
    filteredKits = filteredKits.map(kit => ({
      ...kit,
      templates: filteredTemplates.filter(t => t.kitId === kit.id),
      templateCount: filteredTemplates.filter(t => t.kitId === kit.id).length,
    })).filter(kit => kit.templateCount > 0);

    if (groupByKit) {
      return NextResponse.json({ 
        kits: filteredKits, 
        templates: filteredTemplates,
        totalKits: filteredKits.length,
        totalTemplates: filteredTemplates.length,
        cached: !forceRefresh 
      });
    }

    return NextResponse.json({ 
      templates: filteredTemplates,
      total: filteredTemplates.length,
      cached: !forceRefresh 
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates', templates: [], kits: [], total: 0 }, { status: 500 });
  }
}
