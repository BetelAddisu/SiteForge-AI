import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, username, appPassword } = body;

    if (!url || !username || !appPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Test WordPress REST API with application password
    const response = await fetch(`${url}/wp-json/wp/v2/users/me`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ 
        success: true, 
        user: { name: data.name, email: data.email }
      });
    } else {
      return NextResponse.json({ 
        error: 'Failed to connect to WordPress. Check your credentials.' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('WordPress connection test error:', error);
    return NextResponse.json({ error: 'Failed to connect to WordPress' }, { status: 500 });
  }
}
