import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSignedDownloadUrl } from '@/lib/storage/r2';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch template from database
    const template = await prisma.template.findUnique({
      where: { id },
      include: {
        sections: true,
        kit: true,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate signed download URL for R2
    let downloadUrl: string | null = null;
    if (template.storageProvider === 'r2' && template.storageKey) {
      downloadUrl = await getSignedDownloadUrl(template.storageKey);
    }

    // Add screenshot URL if not present
    const previewImage = template.previewImage || `/api/templates/screenshot?id=${id}`;

    return NextResponse.json({ 
      template: {
        ...template,
        downloadUrl,
        previewImage,
      }
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
