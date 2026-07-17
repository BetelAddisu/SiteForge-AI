/**
 * Template Kit Import Script
 * 
 * Imports Elementor template kits from Supabase storage into the database.
 * Each ZIP file is an Elementor Template Kit containing multiple templates.
 * 
 * Usage: npx ts-node scripts/template-import/import-template-kits.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const storageBucket = 'templates';

const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TemplateManifest {
  manifest_version: string;
  title: string;
  page_builder: string;
  kit_version: string;
  templates: Array<{
    name: string;
    screenshot: string;
    source: string;
    preview_url?: string;
    type: string;
    category: string;
    metadata?: Record<string, unknown>;
    elementor_pro_required: boolean;
  }>;
  required_plugins?: Array<{
    name: string;
    version: string;
  }>;
  images?: Array<{
    filename: string;
    thumbnail_url: string;
  }>;
}

interface TemplateSection {
  id: string;
  name: string;
  type: string;
  source: string;
  screenshot: string;
  content: unknown;
  kitName: string;
  kitSlug: string;
}

async function downloadZip(fileName: string): Promise<Buffer | null> {
  const filePath = `${storageBucket}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .download(fileName);
  
  if (error) {
    console.error(`Failed to download ${fileName}:`, error.message);
    return null;
  }
  
  return Buffer.from(await data.arrayBuffer());
}

async function uploadScreenshot(
  kitSlug: string,
  templateName: string,
  screenshotBuffer: Buffer
): Promise<string | null> {
  const fileName = `${kitSlug}/${templateName.toLowerCase().replace(/\s+/g, '-')}.jpg`;
  
  const { data, error } = await supabase.storage
    .from('template-previews')
    .upload(fileName, screenshotBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (error) {
    console.error(`Failed to upload screenshot for ${templateName}:`, error.message);
    return null;
  }
  
  const { data: urlData } = supabase.storage
    .from('template-previews')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectCategory(templateType: string, templateName: string): string {
  const name = templateName.toLowerCase();
  const type = templateType.toLowerCase();
  
  if (type === 'section' || type === 'header' || type === 'footer') {
    if (name.includes('hero') || name.includes('banner')) return 'hero';
    if (name.includes('about') || name.includes('who')) return 'about';
    if (name.includes('service')) return 'services';
    if (name.includes('team')) return 'team';
    if (name.includes('testimonial') || name.includes('review')) return 'testimonial';
    if (name.includes('pricing') || name.includes('price')) return 'pricing';
    if (name.includes('contact')) return 'contact';
    if (name.includes('faq')) return 'faq';
    if (name.includes('header')) return 'header';
    if (name.includes('footer')) return 'footer';
    if (name.includes('vineyard') || name.includes('product') || name.includes('gallery')) return 'section';
    return 'section';
  }
  
  if (type === 'page' || type === 'single') {
    if (name.includes('home')) return 'hero';
    if (name.includes('contact')) return 'contact';
    if (name.includes('about')) return 'about';
    return 'page';
  }
  
  return type;
}

function detectIndustry(kitName: string): string | null {
  const name = kitName.toLowerCase();
  
  const industries: Record<string, string> = {
    'wine': 'Restaurant',
    'restaurant': 'Restaurant',
    'cafe': 'Restaurant',
    'food': 'Restaurant',
    'digital': 'Technology',
    'tech': 'Technology',
    'software': 'Technology',
    'marketing': 'Marketing',
    'agency': 'Marketing',
    'seo': 'Marketing',
    'medical': 'Healthcare',
    'health': 'Healthcare',
    'clinic': 'Healthcare',
    'fitness': 'Fitness',
    'gym': 'Fitness',
    'yoga': 'Fitness',
    'real estate': 'Real Estate',
    'property': 'Real Estate',
    'estate': 'Real Estate',
    'legal': 'Legal',
    'law': 'Legal',
    'attorney': 'Legal',
    'finance': 'Finance',
    'financial': 'Finance',
    'travel': 'Travel',
    'hotel': 'Travel',
    'tourism': 'Travel',
    'education': 'Education',
    'school': 'Education',
    'university': 'Education',
    'nonprofit': 'Non-Profit',
    'charity': 'Non-Profit',
    'ecommerce': 'E-commerce',
    'shop': 'E-commerce',
    'store': 'E-commerce',
    'creative': 'Creative',
    'portfolio': 'Creative',
    'photography': 'Creative',
    'construction': 'Real Estate',
    'architect': 'Real Estate',
  };
  
  for (const [key, value] of Object.entries(industries)) {
    if (name.includes(key)) return value;
  }
  
  return null;
}

async function parseKitZip(
  zipBuffer: Buffer,
  fileName: string
): Promise<TemplateSection[]> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const templates: TemplateSection[] = [];
  
  // Read manifest.json
  let manifestJson = await zip.file('manifest.json')?.async('string');
  if (!manifestJson) {
    const allFiles = Object.keys(zip.files);
    const manifestPath = allFiles.find(f => f.endsWith('manifest.json'));
    if (manifestPath) {
      manifestJson = await zip.file(manifestPath)?.async('string');
    }
  }
  
  if (!manifestJson) {
    console.log(`No manifest.json found in ${fileName}`);
    return templates;
  }
  
  const manifest: TemplateManifest = JSON.parse(manifestJson);
  const kitSlug = slugify(manifest.title);
  
  console.log(`Processing kit: ${manifest.title} (${manifest.templates.length} templates)`);
  
  for (const template of manifest.templates) {
    // Skip templates requiring Elementor Pro (for MVP)
    if (template.elementor_pro_required) {
      console.log(`  Skipping "${template.name}" - requires Elementor Pro`);
      continue;
    }
    
    // Read template JSON content
    const templateSource = template.source.replace('templates/', '');
    const templateJson = await zip.file(`templates/${templateSource}`)?.async('string');
    
    if (!templateJson) {
      console.log(`  Template file not found: ${template.source}`);
      continue;
    }
    
    // Read screenshot
    let screenshotBuffer: Buffer | null = null;
    try {
      let screenshotEntry = template.screenshot ? zip.file(template.screenshot) : null;
      if (!screenshotEntry) {
        const allFiles = Object.keys(zip.files);
        const namePattern = template.name.toLowerCase().replace(/[^a-z0-9]/g, '.*');
        const slugPattern = slugify(template.name).replace(/[^a-z0-9]/g, '.*');
        
        const match = allFiles.find(f => {
          const lowerF = f.toLowerCase();
          if (!lowerF.includes('screenshots/')) return false;
          return new RegExp(namePattern).test(lowerF) || new RegExp(slugPattern).test(lowerF);
        });
        
        if (match) {
          screenshotEntry = zip.file(match);
        }
      }
      if (screenshotEntry) {
        screenshotBuffer = await screenshotEntry.async('nodebuffer');
      }
    } catch {
      // Screenshot might not exist
    }
    
    templates.push({
      id: `${kitSlug}-${slugify(template.name)}`,
      name: template.name,
      type: detectCategory(template.metadata?.template_type as string || '', template.name),
      source: template.source,
      screenshot: template.screenshot,
      content: JSON.parse(templateJson),
      kitName: manifest.title,
      kitSlug,
    });
  }
  
  return templates;
}

async function importTemplateSection(
  section: TemplateSection,
  uploadScreenshot: boolean = true
): Promise<boolean> {
  try {
    // Check if template already exists
    const existing = await prisma.template.findFirst({
      where: {
        name: section.name,
        extractedPath: { contains: section.kitSlug },
      },
    });
    
    if (existing) {
      console.log(`  Template "${section.name}" already exists, skipping`);
      return true;
    }
    
    // Upload screenshot if available
    let previewImageUrl: string | null = null;
    // Note: Screenshot upload would be done here if we had the buffer
    
    // Create template record
    await prisma.template.create({
      data: {
        name: section.name,
        category: section.type,
        industry: detectIndustry(section.kitName),
        style: 'modern',
        filePath: `templates/${section.kitSlug}.zip`,
        extractedPath: `${section.kitSlug}/${section.source}`,
        previewImage: previewImageUrl,
        metadata: {
          kitName: section.kitName,
          kitSlug: section.kitSlug,
          source: section.source,
          screenshot: section.screenshot,
        },
        tags: [section.kitSlug, section.type],
        importStatus: 'COMPLETE',
        compatibilityScore: 80, // Default score
        compatibilityNotes: {
          greenWidgets: ['heading', 'text-editor', 'image', 'button', 'icon', 'spacer'],
          yellowWidgets: ['container', 'accordion', 'tabs'],
          redWidgets: [],
        },
      },
    });
    
    // Create template section record
    await prisma.templateSection.create({
      data: {
        template: {
          connect: {
            id: (await prisma.template.findFirst({
              where: { name: section.name },
            }))!.id,
          },
        },
        type: section.type,
        title: section.name,
        content: section.content,
        metadata: {
          kitName: section.kitName,
          kitSlug: section.kitSlug,
        },
      },
    });
    
    console.log(`  Imported: ${section.name} (${section.type})`);
    return true;
  } catch (error) {
    console.error(`  Failed to import ${section.name}:`, error);
    return false;
  }
}

async function listTemplateZips(): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(storageBucket)
    .list('', { limit: 100 });
  
  if (error) {
    console.error('Failed to list files:', error.message);
    return [];
  }
  
  return (data || [])
    .filter(file => file.name.endsWith('.zip'))
    .map(file => file.name);
}

async function importLocalZip(filePath: string): Promise<number> {
  console.log(`\n📦 Importing from local file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return 0;
  }
  
  const zipBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const templates = await parseKitZip(zipBuffer, fileName);
  
  let imported = 0;
  for (const template of templates) {
    const success = await importTemplateSection(template, false);
    if (success) imported++;
  }
  
  return imported;
}

async function importFromSupabase(): Promise<number> {
  console.log('📂 Fetching template ZIPs from Supabase storage...');
  
  const files = await listTemplateZips();
  
  if (files.length === 0) {
    console.log('No ZIP files found in Supabase storage.');
    return 0;
  }
  
  console.log(`Found ${files.length} template kits to process.\n`);
  
  let totalImported = 0;
  
  for (const fileName of files) {
    console.log(`\n📦 Processing: ${fileName}`);
    
    const zipBuffer = await downloadZip(fileName);
    if (!zipBuffer) {
      console.log(`  Failed to download, skipping`);
      continue;
    }
    
    const templates = await parseKitZip(zipBuffer, fileName);
    
    for (const template of templates) {
      const success = await importTemplateSection(template, true);
      if (success) totalImported++;
    }
  }
  
  return totalImported;
}

async function main() {
  console.log('🎨 SiteForge AI - Template Kit Importer\n');
  console.log('='.repeat(50));
  
  // Check environment
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables!');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  // Check for local files to import
  const localFiles = process.argv.slice(2);
  
  if (localFiles.length > 0) {
    // Import specific local files
    let totalImported = 0;
    for (const file of localFiles) {
      totalImported += await importLocalZip(file);
    }
    console.log(`\n✅ Import complete! Total templates imported: ${totalImported}`);
    return;
  }
  
  // Import from Supabase storage
  const totalImported = await importFromSupabase();
  console.log(`\n✅ Import complete! Total templates imported: ${totalImported}`);
  
  // Print summary
  const templateCount = await prisma.template.count();
  const sectionCount = await prisma.templateSection.count();
  
  console.log('\n📊 Database Summary:');
  console.log(`   Templates: ${templateCount}`);
  console.log(`   Sections: ${sectionCount}`);
}

// Export for use as module
export { parseKitZip, importTemplateSection, detectCategory, detectIndustry, slugify };

// Run if executed directly
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });
