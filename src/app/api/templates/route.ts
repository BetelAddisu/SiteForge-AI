import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

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
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(arrayBuffer);

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = slugify(manifest.title);

        for (const template of manifest.templates) {
          if (template.elementor_pro_required) continue;
          const templateSlug = slugify(template.name);

          let screenshotUrl: string | null = null;
          try {
            const screenshotPath = zipFile.name.replace('.zip', `/${template.screenshot}`);
            const { data: screenshotData } = supabase.storage.from('templates').getPublicUrl(screenshotPath);
            screenshotUrl = screenshotData.publicUrl;
          } catch {}

          templates.push({
            id: `${kitSlug}-${templateSlug}`,
            name: template.name,
            category: detectCategory(template.name),
            industry: detectIndustry(manifest.title),
            kitName: manifest.title,
            kitSlug,
            previewImage: null,
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
  if (templateCache && (now - templateCache.updatedAt) < CACHE_TTL) {
    return templateCache.templates;
  }

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
