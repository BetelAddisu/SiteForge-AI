import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

// Load templates from local filesystem
function loadLocalTemplates(): Array<{
  id: string;
  name: string;
  category: string;
  industry: string | null;
  kitName: string;
  kitSlug: string;
  previewImage: string | null;
  compatibilityScore: number;
}> {
  const templatesDir = path.join(process.cwd(), 'templates');
  const templates: Array<{
    id: string;
    name: string;
    category: string;
    industry: string | null;
    kitName: string;
    kitSlug: string;
    previewImage: string | null;
    compatibilityScore: number;
  }> = [];

  if (!fs.existsSync(templatesDir)) {
    return templates;
  }

  const kitDirs = fs.readdirSync(templatesDir);
  
  for (const kitDir of kitDirs) {
    const kitPath = path.join(templatesDir, kitDir);
    
    if (!fs.statSync(kitPath).isDirectory()) continue;
    
    // Read each template JSON file
    const kitTemplates = fs.readdirSync(kitPath)
      .filter(f => f.endsWith('.json') && f !== 'kit-manifest.json');
    
    for (const templateFile of kitTemplates) {
      try {
        const templateData = JSON.parse(
          fs.readFileSync(path.join(kitPath, templateFile), 'utf8')
        );
        
        templates.push({
          id: templateData.id,
          name: templateData.name,
          category: templateData.category,
          industry: templateData.industry,
          kitName: templateData.kitName,
          kitSlug: templateData.kitSlug,
          previewImage: templateData.screenshot,
          compatibilityScore: 85,
        });
      } catch (e) {
        // Skip invalid template files
      }
    }
  }

  return templates;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const industry = searchParams.get('industry');
    const search = searchParams.get('search');

    // Load from local filesystem
    let templates = loadLocalTemplates();

    // Apply filters
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    if (industry) {
      templates = templates.filter(t => t.industry === industry);
    }
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchLower) ||
        (t.industry && t.industry.toLowerCase().includes(searchLower)) ||
        t.category.toLowerCase().includes(searchLower)
      );
    }

    // Try to supplement with database templates
    try {
      const dbTemplates = await prisma.template.findMany({
        where: { importStatus: 'COMPLETE' },
        take: 100,
        select: {
          id: true,
          name: true,
          category: true,
          industry: true,
          previewImage: true,
          compatibilityScore: true,
        },
      });

      // Merge database templates if they don't exist locally
      const localIds = new Set(templates.map(t => t.id));
      for (const dbT of dbTemplates) {
        if (!localIds.has(dbT.id)) {
          templates.push({
            id: dbT.id,
            name: dbT.name,
            category: dbT.category,
            industry: dbT.industry,
            kitName: '',
            kitSlug: '',
            previewImage: dbT.previewImage,
            compatibilityScore: dbT.compatibilityScore || 85,
          });
        }
      }
    } catch (dbError) {
      console.log('Database not available, using local templates only');
    }

    return NextResponse.json({ 
      templates,
      total: templates.length 
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    
    // Fallback to local templates on error
    const localTemplates = loadLocalTemplates();
    return NextResponse.json({ 
      templates: localTemplates,
      total: localTemplates.length 
    });
  }
}
