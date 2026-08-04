import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorageProvider } from '@/lib/storage';

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

    // Generate signed download URL for the configured storage
    let downloadUrl: string | null = null;
    if (template.storageProvider === 'r2' && template.storageKey) {
      const provider = await getStorageProvider();
      downloadUrl = await provider.getSignedDownloadUrl(template.storageKey);
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
