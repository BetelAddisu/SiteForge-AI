import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl, listFiles } from '@/lib/storage/r2';

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');
    const kitSlug = searchParams.get('kit');
    const templateId = searchParams.get('id');
    const getDownloadUrl = searchParams.get('download') === 'true';

    // Single template by ID - return signed URL
    if (templateId) {
      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      // Generate signed URL for R2
      if (template.storageProvider === 'r2' && template.storageKey) {
        const signedUrl = await getSignedDownloadUrl(template.storageKey);
        return NextResponse.json({ 
          downloadUrl: signedUrl,
          template: {
            id: template.id,
            name: template.name,
            category: template.category,
            storageKey: template.storageKey,
          }
        });
      }

      return NextResponse.json({ error: 'Template storage not configured' }, { status: 500 });
    }

    // Fetch all templates from database
    const whereClause: Record<string, unknown> = { importStatus: 'COMPLETE' };
    if (category) whereClause.category = category;
    if (industry) whereClause.industry = industry;
    if (kitSlug) whereClause.kitSlug = kitSlug;

    const templates = await prisma.template.findMany({
      where: whereClause,
      include: {
        kit: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all kits
    const kitWhere: Record<string, unknown> = { importStatus: 'COMPLETE' };
    if (industry) kitWhere.industry = industry;

    const kits = await prisma.templateKit.findMany({
      where: kitWhere,
      include: {
        templates: {
          where: { importStatus: 'COMPLETE' },
          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            previewImage: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Filter by search
    let filteredTemplates = templates;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTemplates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
        t.category.toLowerCase().includes(searchLower) ||
        (t.kitName && t.kitName.toLowerCase().includes(searchLower))
      );
    }

    // Filter kits based on templates
    const kitIds = new Set(filteredTemplates.map(t => t.kitId));
    let filteredKits = kits.filter(k => kitIds.has(k.id));

    // Update kits to only include their filtered templates
    filteredKits = filteredKits.map(kit => ({
      ...kit,
      templates: filteredTemplates.filter(t => t.kitId === kit.id),
      templateCount: filteredTemplates.filter(t => t.kitId === kit.id).length,
    }));

    return NextResponse.json({ 
      kits: filteredKits, 
      templates: filteredTemplates,
      totalKits: filteredKits.length,
      totalTemplates: filteredTemplates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates', kits: [], templates: [], total: 0 }, { status: 500 });
  }
}
