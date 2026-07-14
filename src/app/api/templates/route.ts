import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface CachedTemplates {
  templates: Array<{
    id: string;
    name: string;
    category: string;
    industry: string | null;
    kitName: string;
    kitSlug: string;
    previewImage: string | null;
    screenshotUrl: string | null;
    compatibilityScore: number;
  }>;
  updatedAt: number;
}

let templateCache: CachedTemplates | null = null;
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

async function fetchTemplatesFromDatabase() {
  try {
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

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      industry: t.industry,
      kitName: (t.metadata as { kitName?: string })?.kitName || '',
      kitSlug: (t.metadata as { kitSlug?: string })?.kitSlug || '',
      previewImage: t.previewImage,
      screenshotUrl: t.previewImage,
      compatibilityScore: t.compatibilityScore || 85,
    }));
  } catch (error) {
    console.log('Database not available, falling back to Supabase storage');
    return null;
  }
}

async function fetchTemplatesFromSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('Supabase not configured');
    return [];
  }

  const supabase = getSupabaseAdmin();
  const templates: Array<{
    id: string; name: string; category: string; industry: string | null;
    kitName: string; kitSlug: string; previewImage: string | null;
    screenshotUrl: string | null; compatibilityScore: number;
  }> = [];

  try {
    const { data: files, error } = await supabase.storage.from('templates').list('', { limit: 200 });
    if (error || !files) {
      console.error('Error listing templates bucket:', error);
      return [];
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

        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          const templateSlug = slugify(template.name);

          // Try to get screenshot from template-screenshots bucket
          let screenshotUrl: string | null = null;
          try {
            const screenshotPath = `${kitSlug}/${templateSlug}.jpg`;
            const { data: screenshotData } = supabase.storage.from('template-screenshots').getPublicUrl(screenshotPath);
            screenshotUrl = screenshotData.publicUrl;
          } catch {}

          templates.push({
            id: `${kitSlug}-${templateSlug}`,
            name: template.name,
            category: detectCategory(template.name),
            industry: detectIndustry(manifest.title),
            kitName: manifest.title,
            kitSlug,
            previewImage: screenshotUrl,
            screenshotUrl,
            compatibilityScore: 85,
          });
        }
      } catch (err) {
        console.error(`Error processing ${zipFile.name}:`, err);
      }
    }
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
  }

  return templates;
}

async function getTemplates() {
  const now = Date.now();
  
  // Check cache first
  if (templateCache && (now - templateCache.updatedAt) < CACHE_TTL) {
    return templateCache.templates;
  }

  // Try database first
  const dbTemplates = await fetchTemplatesFromDatabase();
  if (dbTemplates && dbTemplates.length > 0) {
    templateCache = { templates: dbTemplates, updatedAt: now };
    return dbTemplates;
  }

  // Fall back to Supabase storage
  const templates = await fetchTemplatesFromSupabase();
  templateCache = { templates, updatedAt: now };
  return templates;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (forceRefresh) templateCache = null;

    let templates = await getTemplates();

    if (category) templates = templates.filter(t => t.category === category);
    if (industry) templates = templates.filter(t => t.industry === industry);
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
        t.category.toLowerCase().includes(searchLower) ||
        t.kitName.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({ templates, total: templates.length, cached: !forceRefresh });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates', templates: [], total: 0 }, { status: 500 });
  }
}
