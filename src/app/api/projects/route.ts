import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Create Supabase server client that reads from cookies
async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore errors in read-only context
            }
          });
        },
      },
    }
  );
}

interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('GET /api/projects - Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to view your projects', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Find our user record
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      return NextResponse.json({ projects: [] });
    }

    // Fetch user's projects
    const projects = await prisma.project.findMany({
      where: { userId: appUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        assets: true,
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to fetch projects', message: errorMessage, code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let userId: string | null = null;
  let appUserId: string | null = null;
  
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('POST /api/projects - Auth check:', { 
      hasUser: !!user, 
      userId: user?.id,
      authError: authError?.message 
    });
    
    if (authError || !user) {
      const response: ErrorResponse = {
        error: 'Unauthorized',
        message: 'Please sign in to create a project',
        code: 'AUTH_REQUIRED',
      };
      console.error('POST /api/projects - Auth failed:', authError);
      return NextResponse.json(response, { status: 401 });
    }
    
    userId = user.id;

    // Validate Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const response: ErrorResponse = {
        error: 'Configuration error',
        message: 'Database configuration is incomplete',
        code: 'CONFIG_ERROR',
      };
      console.error('POST /api/projects: Supabase not configured');
      return NextResponse.json(response, { status: 500 });
    }

    // Find or create our user record
    let appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });

    if (!appUser) {
      console.log(`Creating new user record for supabaseId: ${user.id}`);
      appUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || null,
        },
      });
    }
    
    appUserId = appUser.id;

    // Validate required fields
    const body = await request.json();
    const { 
      businessName, 
      industry, 
      description,
      templateId,
      kitId,
      templateSource,
      stylePreset,
      brandColors,
      businessInfo,
    } = body;

    // Detailed validation
    if (!businessName || typeof businessName !== 'string' || businessName.trim() === '') {
      const response: ErrorResponse = {
        error: 'Validation error',
        message: 'Business name is required and cannot be empty',
        code: 'VALIDATION_ERROR',
        details: { field: 'businessName', value: businessName },
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Validate businessInfo if provided
    let parsedBusinessInfo = null;
    if (businessInfo) {
      if (typeof businessInfo === 'string') {
        try {
          parsedBusinessInfo = JSON.parse(businessInfo);
        } catch {
          const response: ErrorResponse = {
            error: 'Validation error',
            message: 'Invalid businessInfo format - must be valid JSON',
            code: 'VALIDATION_ERROR',
          };
          return NextResponse.json(response, { status: 400 });
        }
      } else {
        parsedBusinessInfo = businessInfo;
      }
    }

    // Validate brandColors if provided
    let parsedBrandColors = null;
    if (brandColors) {
      if (typeof brandColors === 'string') {
        try {
          parsedBrandColors = JSON.parse(brandColors);
        } catch {
          const response: ErrorResponse = {
            error: 'Validation error',
            message: 'Invalid brandColors format - must be valid JSON',
            code: 'VALIDATION_ERROR',
          };
          return NextResponse.json(response, { status: 400 });
        }
      } else {
        parsedBrandColors = brandColors;
      }
    }

    // Validate templateId if provided (check it exists)
    if (templateId) {
      const templateExists = await prisma.template.findUnique({
        where: { id: templateId },
        select: { id: true },
      });
      
      if (!templateExists) {
        console.warn(`Template ${templateId} not found, proceeding without template`);
      }
    }

    // Validate templateSource if provided
    const validTemplateSources = ['template', 'kit'];
    if (templateSource && !validTemplateSources.includes(templateSource)) {
      const response: ErrorResponse = {
        error: 'Validation error',
        message: 'Invalid templateSource. Must be "template" or "kit"',
        code: 'VALIDATION_ERROR',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.log(`Creating project for user ${appUserId}:`, {
      businessName: businessName.trim(),
      industry,
      hasTemplate: !!templateId,
      hasKit: !!kitId,
      templateSource,
      hasBrandColors: !!parsedBrandColors,
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        userId: appUser.id,
        businessName: businessName.trim(),
        industry: industry?.trim() || null,
        description: description?.trim() || null,
        status: 'DRAFT',
        templateId: templateId || null,
        kitId: kitId || null,
        templateSource: templateSource || null,
        stylePreset: stylePreset?.trim() || null,
        brandColors: parsedBrandColors,
        businessInfo: parsedBusinessInfo,
      },
    });

    console.log(`Project created successfully: ${project.id}`);
    return NextResponse.json({ 
      project,
      message: 'Project created successfully',
    }, { status: 201 });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = error instanceof Error ? error.name : 'UNKNOWN_ERROR';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error creating project:', {
      error: errorMessage,
      code: errorCode,
      stack: errorStack,
      userId,
      appUserId,
    });

    // Check if it's a Prisma connection error
    const isPrismaInitError = errorCode === 'PrismaClientInitializationError' || 
      errorMessage.includes('connection') || 
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('timeout') ||
      errorStack?.includes('PrismaClientInitializationError');
    
    // Handle specific Prisma errors
    if (isPrismaInitError) {
      const response: ErrorResponse = {
        error: 'Database connection error',
        message: `Unable to connect to the database: ${errorMessage}`,
        code: 'DB_CONNECTION_ERROR',
      };
      return NextResponse.json(response, { status: 503 });
    }

    if (errorCode === 'PrismaClientKnownRequestError') {
      const prismaError = error as { code?: string; meta?: { target?: string[] } };
      if (prismaError.code === 'P2002') {
        const response: ErrorResponse = {
          error: 'Duplicate entry',
          message: 'A project with this name already exists for your account',
          code: 'DUPLICATE_ERROR',
        };
        return NextResponse.json(response, { status: 409 });
      }
    }

    // Generic error - show the actual message
    const response: ErrorResponse = {
      error: 'Failed to create project',
      message: errorMessage,
      code: 'CREATE_ERROR',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
