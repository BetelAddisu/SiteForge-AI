/**
 * Simple Local Template Importer
 * 
 * Imports a single Elementor template kit ZIP file directly.
 * No Supabase dependency for initial import.
 * 
 * Usage: npx ts-node scripts/import-local-template.ts <path-to-zip>
 * 
 * Example:
 *   npx ts-node scripts/import-local-template.ts /workspace/saras-wine-template-kit.zip
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

interface ManifestTemplate {
  name: string;
  screenshot: string;
  source: string;
  type: string;
  category: string;
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
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectCategory(templateType: string, templateName: string): string {
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
    ['wine', 'Restaurant'],
    ['restaurant', 'Restaurant'],
    ['cafe', 'Restaurant'],
    ['food', 'Restaurant'],
    ['digital', 'Technology'],
    ['tech', 'Technology'],
    ['marketing', 'Marketing'],
    ['agency', 'Marketing'],
    ['medical', 'Healthcare'],
    ['health', 'Healthcare'],
    ['fitness', 'Fitness'],
    ['gym', 'Fitness'],
    ['real estate', 'Real Estate'],
    ['property', 'Real Estate'],
    ['legal', 'Legal'],
    ['law', 'Legal'],
    ['finance', 'Finance'],
    ['financial', 'Finance'],
    ['travel', 'Travel'],
    ['hotel', 'Travel'],
    ['education', 'Education'],
    ['nonprofit', 'Non-Profit'],
    ['charity', 'Non-Profit'],
    ['ecommerce', 'E-commerce'],
    ['shop', 'E-commerce'],
    ['creative', 'Creative'],
    ['portfolio', 'Creative'],
  ];
  
  for (const [key, value] of industries) {
    if (name.includes(key)) return value;
  }
  
  return null;
}

async function importTemplateZip(zipPath: string) {
  console.log(`\n🎨 SiteForge AI - Template Importer`);
  console.log('='.repeat(50));
  console.log(`\n📦 Processing: ${path.basename(zipPath)}`);
  
  if (!fs.existsSync(zipPath)) {
    console.error(`❌ File not found: ${zipPath}`);
    process.exit(1);
  }
  
  const zipBuffer = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(zipBuffer);
  
  // Read manifest
  const manifestJson = await zip.file('manifest.json')?.async('string');
  if (!manifestJson) {
    console.error('❌ No manifest.json found in ZIP');
    process.exit(1);
  }
  
  const manifest: Manifest = JSON.parse(manifestJson);
  const kitSlug = slugify(manifest.title);
  
  console.log(`📋 Kit Name: ${manifest.title}`);
  console.log(`🔢 Total Templates: ${manifest.templates.length}`);
  console.log(`🆔 Kit Slug: ${kitSlug}`);
  
  const outputDir = path.join(__dirname, '..', '..', 'templates', kitSlug);
  fs.mkdirSync(outputDir, { recursive: true });
  
  let imported = 0;
  let skipped = 0;
  
  console.log('\n📄 Importing templates:\n');
  
  for (const template of manifest.templates) {
    const templateSlug = slugify(template.name);
    
    // Skip Elementor Pro templates
    if (template.elementor_pro_required) {
      console.log(`  ⏭️  Skipping (Pro): ${template.name}`);
      skipped++;
      continue;
    }
    
    // Read template content
    const templateContent = await zip.file(template.source)?.async('string');
    if (!templateContent) {
      console.log(`  ❌ Missing: ${template.name} (${template.source})`);
      continue;
    }
    
    // Read screenshot
    let screenshotPath: string | null = null;
    try {
      const screenshotData = await zip.file(template.screenshot)?.async('nodebuffer');
      if (screenshotData) {
        screenshotPath = path.join(outputDir, `${templateSlug}.jpg`);
        fs.writeFileSync(screenshotPath, screenshotData);
      }
    } catch {
      // Screenshot might not exist
    }
    
    // Create template data file
    const category = detectCategory(template.metadata?.template_type as string || '', template.name);
    const templateData = {
      id: `${kitSlug}-${templateSlug}`,
      name: template.name,
      category,
      industry: detectIndustry(manifest.title),
      kitName: manifest.title,
      kitSlug,
      source: template.source,
      screenshot: screenshotPath ? `/templates/${kitSlug}/${templateSlug}.jpg` : null,
      type: template.type,
      requiresElementorPro: template.elementor_pro_required,
      content: JSON.parse(templateContent),
    };
    
    const templateFile = path.join(outputDir, `${templateSlug}.json`);
    fs.writeFileSync(templateFile, JSON.stringify(templateData, null, 2));
    
    console.log(`  ✅ ${template.name} (${category})`);
    imported++;
  }
  
  // Save kit manifest
  const kitData = {
    name: manifest.title,
    slug: kitSlug,
    totalTemplates: manifest.templates.length,
    importedTemplates: imported,
    skippedTemplates: skipped,
    importedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(outputDir, 'kit-manifest.json'),
    JSON.stringify(kitData, null, 2)
  );
  
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Import Complete!`);
  console.log(`   Imported: ${imported} templates`);
  console.log(`   Skipped: ${skipped} templates (Elementor Pro required)`);
  console.log(`   Output: ${outputDir}`);
  
  // Create a simple JSON export that can be imported to database
  const exportData = {
    kit: kitData,
    templates: manifest.templates
      .filter(t => !t.elementor_pro_required)
      .map(t => ({
        name: t.name,
        category: detectCategory(t.metadata?.template_type as string || '', t.name),
        source: t.source,
      })),
  };
  
  const exportPath = path.join(outputDir, 'import-export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`\n📤 Export data: ${exportPath}`);
}

// Get file path from command line
const zipPath = process.argv[2];
if (!zipPath) {
  console.log(`
🎨 SiteForge AI - Template Importer

Usage: npx ts-node scripts/import-local-template.ts <path-to-zip>

Example: npx ts-node scripts/import-local-template.ts /workspace/saras-wine.zip
`);
  process.exit(1);
}

importTemplateZip(zipPath).catch(console.error);
