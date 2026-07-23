import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      include: {
        sections: true,
      },
      take: 5,
    });

    const result = templates.map(t => ({
      id: t.id,
      name: t.name,
      sectionCount: t.sections.length,
      sections: t.sections.map(s => ({
        id: s.id,
        type: s.type,
        contentLength: Array.isArray(s.content) ? s.content.length : 0,
      })),
    }));

    return NextResponse.json({
      templateCount: templates.length,
      templates: result,
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
