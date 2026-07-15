import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

interface ManifestTemplate {
  name: string;
  screenshot: string;
  elementor_pro_required: boolean;
}

interface Manifest {
  title: string;
  templates: ManifestTemplate[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // First try database
    try {
      const template = await prisma.template.findUnique({
        where: { id },
        include: {
          sections: true,
        },
      });

      if (template) {
        // Add screenshot URL if not present
        if (!template.previewImage) {
          template.previewImage = `/api/templates/screenshot?id=${id}`;
        }
        return NextResponse.json({ template });
      }
    } catch (dbError) {
      console.log('Database not available, trying Supabase storage...');
    }

    // Not in database - search Supabase storage
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // List all ZIP files
    const { data: files, error } = await supabase.storage
      .from('templates')
      .list('', { limit: 200 });

    if (error || !files) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const zipFiles = files.filter(f => f.name.endsWith('.zip'));

    // Search in ZIPs
    for (const zipFile of zipFiles) {
      try {
        const { data: zipData, error: downloadError } = await supabase.storage
          .from('templates')
          .download(zipFile.name);

        if (downloadError || !zipData) continue;

        const arrayBuffer = await zipData.arrayBuffer();
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(arrayBuffer);

        const manifestFile = zip.file('manifest.json');
        if (!manifestFile) continue;

        const manifestContent = await manifestFile.async('string');
        const manifest: Manifest = JSON.parse(manifestContent);
        const kitSlug = slugify(manifest.title);

        // Find matching template
        for (const template of manifest.templates) {
          const templateSlug = slugify(template.name);
          const templateId = `${kitSlug}-${templateSlug}`;

          if (templateId === id || id.includes(templateSlug)) {
            // Get screenshot
            const screenshotUrl = `/api/templates/screenshot?id=${templateId}`;

            return NextResponse.json({
              template: {
                id: templateId,
                name: template.name,
                category: 'section',
                industry: null,
                kitName: manifest.title,
                previewImage: screenshotUrl,
                screenshotUrl,
                compatibilityScore: 85,
              }
            });
          }
        }
      } catch (err) {
        console.error(`Error processing ${zipFile.name}:`, err);
      }
    }

    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
