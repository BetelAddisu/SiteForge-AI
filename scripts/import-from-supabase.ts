/**
 * Import Templates from Supabase Storage
 * 
 * This script:
 * 1. Lists all ZIP files from Supabase storage bucket 'templates'
 * 2. Downloads and parses each ZIP to extract template metadata
 * 3. Uploads screenshots to 'template-screenshots' bucket
 * 4. Imports templates to the database
 * 
 * Usage:
 *   npx ts-node scripts/import-from-supabase.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ManifestTemplate {
  name: string;
  screenshot: string;
  source: string;
  type: string;
  metadata?: Record<string, unknown>;
  elementor_pro_required: boolean;
}

interface Manifest {
  manifest_version: string;
  title: string;
  page_builder: string;
  templates: ManifestTemplate[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function detectCategory(templateName: string): string {
  const name = templateName.toLowerCase();
  if (name.includes('hero') || name.includes('home') || name.includes('banner')) return 'hero';
  if (name.includes('about') || name.includes('who')) return 'about';
  if (name.includes('service')) return 'services';
  if (name.includes('pricing') || name.includes('price')) return 'pricing';
  if (name.includes('team')) return 'team';
  if (name.includes('testimonial') || name.includes('review')) return 'testimonial';
  if (name.includes('faq')) return 'faq';
  if (name.includes('contact')) return 'contact';
  if (name.includes('header')) return 'header';
  if (name.includes('footer')) return 'footer';
  if (name.includes('product')) return 'product';
  if (name.includes('404')) return 'error';
  return 'section';
}

function detectIndustry(kitName: string): string | null {
  const name = kitName.toLowerCase();
  const industries: [string, string][] = [
    ['wine', 'Restaurant'], ['restaurant', 'Restaurant'], ['cafe', 'Restaurant'], ['food', 'Restaurant'],
    ['digital', 'Technology'], ['tech', 'Technology'],
    ['marketing', 'Marketing'], ['agency', 'Marketing'],
    ['medical', 'Healthcare'], ['health', 'Healthcare'],
    ['fitness', 'Fitness'], ['gym', 'Fitness'],
    ['real estate', 'Real Estate'], ['property', 'Real Estate'],
    ['legal', 'Legal'], ['law', 'Legal'],
    ['finance', 'Finance'], ['financial', 'Finance'],
    ['travel', 'Travel'], ['hotel', 'Travel'],
    ['education', 'Education'],
    ['nonprofit', 'Non-Profit'], ['charity', 'Non-Profit'],
    ['ecommerce', 'E-commerce'], ['shop', 'E-commerce'],
    ['creative', 'Creative'], ['portfolio', 'Creative'],
  ];
  for (const [key, value] of industries) {
    if (name.includes(key)) return value;
  }
  return null;
}

async function uploadScreenshot(
  kitSlug: string,
  templateSlug: string,
  screenshotData: Buffer
): Promise<string | null> {
  const fileName = `${kitSlug}/${templateSlug}.jpg`;
  
  const { data, error } = await supabase.storage
    .from('template-screenshots')
    .upload(fileName, screenshotData, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (error) {
    console.error(`Failed to upload screenshot: ${fileName}`, error);
    return null;
  }
  
  const { data: urlData } = supabase.storage
    .from('template-screenshots')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}

async function processZipFile(zipFileName: string): Promise<number> {
  console.log(`\n📦 Processing: ${zipFileName}`);
  
  // Download ZIP
  const { data: zipData, error: downloadError } = await supabase.storage
    .from('templates')
    .download(zipFileName);
  
  if (downloadError || !zipData) {
    console.error(`Failed to download: ${zipFileName}`);
    return 0;
  }
  
  const arrayBuffer = await zipData.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Find manifest
  let manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    const allFiles = Object.keys(zip.files);
    const manifestPath = allFiles.find(f => f.endsWith('manifest.json'));
    if (manifestPath) {
      manifestFile = zip.file(manifestPath);
    }
  }
  
  if (!manifestFile) {
    console.log(`No manifest.json in ${zipFileName}`);
    return 0;
  }
  
  const manifestContent = await manifestFile.async('string');
  const manifest: Manifest = JSON.parse(manifestContent);
  const kitSlug = slugify(manifest.title);
  
  console.log(`📋 Kit: ${manifest.title} (${manifest.templates.length} templates)`);
  
  let imported = 0;
  
  for (const template of manifest.templates) {
    // Skip Elementor Pro templates
    if (template.elementor_pro_required) {
      console.log(`  ⏭️  Skipping (Pro): ${template.name}`);
      continue;
    }
    
    const templateSlug = slugify(template.name);
    
    // Check if already imported
    const existing = await prisma.template.findFirst({
      where: { id: `${kitSlug}-${templateSlug}` },
    });
    
    if (existing) {
      console.log(`  ✓ Already exists: ${template.name}`);
      continue;
    }
    
    // Upload screenshot
    let screenshotUrl: string | null = null;
    try {
      let screenshotEntry = template.screenshot ? zip.file(template.screenshot) : null;
      if (!screenshotEntry) {
        const allFiles = Object.keys(zip.files);
        const namePattern = template.name.toLowerCase().replace(/[^a-z0-9]/g, '.*');
        const slugPattern = templateSlug.toLowerCase().replace(/[^a-z0-9]/g, '.*');
        
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
        const screenshotData = await screenshotEntry.async('nodebuffer');
        screenshotUrl = await uploadScreenshot(kitSlug, templateSlug, screenshotData);
        if (screenshotUrl) {
          console.log(`  📷 Uploaded screenshot: ${template.name}`);
        }
      }
    } catch (err) {
      console.log(`  ⚠️  No screenshot for: ${template.name}`);
    }
    
    // Create template in database
    try {
      await prisma.template.create({
        data: {
          id: `${kitSlug}-${templateSlug}`,
          name: template.name,
          category: detectCategory(template.name),
          industry: detectIndustry(manifest.title),
          style: 'modern',
          filePath: `templates/${zipFileName}`,
          previewImage: screenshotUrl,
          metadata: {
            kitName: manifest.title,
            kitSlug,
            source: template.source,
            screenshot: template.screenshot,
          },
          tags: [kitSlug, detectCategory(template.name)],
          importStatus: 'COMPLETE',
          compatibilityScore: 85,
          compatibilityNotes: {
            greenWidgets: ['heading', 'text-editor', 'image', 'button', 'icon', 'spacer'],
            yellowWidgets: ['container', 'accordion', 'tabs'],
            redWidgets: [],
          },
        },
      });
      
      console.log(`  ✅ Imported: ${template.name}`);
      imported++;
    } catch (err) {
      console.error(`  ❌ Failed to import: ${template.name}`, err);
    }
  }
  
  return imported;
}

async function main() {
  console.log('🎨 SiteForge AI - Template Importer from Supabase\n');
  console.log('='.repeat(50));
  
  // Create screenshot bucket if not exists (will fail silently if exists)
  try {
    await supabase.storage.createBucket('template-screenshots', {
      public: true,
    });
    console.log('Created bucket: template-screenshots');
  } catch (err) {
    // Bucket might already exist
  }
  
  // List all ZIP files
  const { data: files, error } = await supabase.storage
    .from('templates')
    .list('', { limit: 200 });
  
  if (error || !files) {
    console.error('Failed to list files:', error);
    process.exit(1);
  }
  
  const zipFiles = files.filter(f => f.name.endsWith('.zip'));
  console.log(`Found ${zipFiles.length} ZIP files\n`);
  
  let totalImported = 0;
  
  for (const zipFile of zipFiles) {
    const imported = await processZipFile(zipFile.name);
    totalImported += imported;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Import Complete!`);
  console.log(`   Total templates imported: ${totalImported}`);
  
  // Show stats
  const count = await prisma.template.count();
  console.log(`   Total in database: ${count}`);
  
  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
