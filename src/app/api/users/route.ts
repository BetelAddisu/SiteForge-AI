import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supabaseId, email, name } = body;

    if (!supabaseId || !email) {
      return NextResponse.json({ error: 'supabaseId and email are required' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (existing) {
      return NextResponse.json({ user: existing });
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        supabaseId,
        email,
        name: name || null,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
