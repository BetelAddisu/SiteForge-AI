import { NextResponse } from 'next/server';
import { generateHTML, ExportData } from '@/lib/export';

export async function POST(request: Request) {
  try {
    const data: ExportData = await request.json();

    if (!data.businessName) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    const html = generateHTML(data);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${data.businessName.toLowerCase().replace(/\s+/g, '-')}-website.html"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json(
      { error: 'Failed to generate website' },
      { status: 500 }
    );
  }
}

// GET endpoint returns a demo template
export async function GET() {
  const demoData: ExportData = {
    businessName: 'My Business',
    tagline: 'Your tagline here',
    description: 'A great local business serving our community.',
    sections: [
      {
        type: 'hero',
        title: 'Welcome to My Business',
        subtitle: 'We provide excellent service to our customers.',
      },
      {
        type: 'services',
        title: 'Our Services',
        items: [
          { title: 'Service 1', description: 'Description of your first service.' },
          { title: 'Service 2', description: 'Description of your second service.' },
          { title: 'Service 3', description: 'Description of your third service.' },
        ],
      },
      {
        type: 'about',
        title: 'About Us',
        content: 'We have been serving our community for over 10 years with quality services and customer satisfaction.',
      },
      {
        type: 'contact',
        title: 'Contact Us',
      },
    ],
    brandColors: {
      primary: '#3B82F6',
      secondary: '#1E40AF',
      accent: '#F59E0B',
    },
    contact: {
      email: 'contact@mybusiness.com',
      phone: '(555) 123-4567',
    },
  };

  const html = generateHTML(demoData);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
