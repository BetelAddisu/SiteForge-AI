/**
 * Simple Template Importer (JavaScript version)
 * 
 * Run with: node scripts/import-template.js <path-to-zip>
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function detectCategory(templateType, templateName) {
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

function detectIndustry(kitName) {
  const name = kitName.toLowerCase();
  
  const industries = [
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

async function importTemplateZip(zipPath) {
  console.log(`\n🎨 SiteForge AI - Template Importer`);
  console.log('='.repeat(50));
  console.log(`\n📦 Processing: ${path.basename(zipPath)}`);
  
  if (!fs.existsSync(zipPath)) {
    console.error(`❌ File not found: ${zipPath}`);
    process.exit(1);
  }
  
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  
  // Find manifest
  const manifestEntry = entries.find(e => e.entryName === 'manifest.json');
  if (!manifestEntry) {
    console.error('❌ No manifest.json found in ZIP');
    process.exit(1);
  }
  
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  const kitSlug = slugify(manifest.title);
  
  console.log(`📋 Kit Name: ${manifest.title}`);
  console.log(`🔢 Total Templates: ${manifest.templates.length}`);
  console.log(`🆔 Kit Slug: ${kitSlug}`);
  
  const outputDir = path.join(__dirname, '..', 'templates', kitSlug);
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
    
    // Find template JSON file
    const templatePath = template.source;
    const templateEntry = entries.find(e => e.entryName === templatePath);
    
    if (!templateEntry) {
      console.log(`  ❌ Missing: ${template.name} (${templatePath})`);
      continue;
    }
    
    // Read screenshot if exists
    const screenshotPath = template.screenshot;
    const screenshotEntry = entries.find(e => e.entryName === screenshotPath);
    let screenshotOutputPath = null;
    
    if (screenshotEntry) {
      try {
        const screenshotData = screenshotEntry.getData();
        screenshotOutputPath = path.join(outputDir, `${templateSlug}.jpg`);
        fs.writeFileSync(screenshotOutputPath, screenshotData);
        screenshotOutputPath = `/templates/${kitSlug}/${templateSlug}.jpg`;
      } catch (e) {
        // Screenshot might fail
      }
    }
    
    // Create template data
    const category = detectCategory(template.metadata?.template_type || '', template.name);
    const templateData = {
      id: `${kitSlug}-${templateSlug}`,
      name: template.name,
      category,
      industry: detectIndustry(manifest.title),
      kitName: manifest.title,
      kitSlug,
      source: template.source,
      screenshot: screenshotOutputPath,
      type: template.type,
      requiresElementorPro: template.elementor_pro_required,
      content: JSON.parse(templateEntry.getData().toString('utf8')),
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
    templates: manifest.templates
      .filter(t => !t.elementor_pro_required)
      .map(t => ({
        name: t.name,
        category: detectCategory(t.metadata?.template_type || '', t.name),
        source: t.source,
      })),
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
}

// Get file path from command line
const zipPath = process.argv[2];
if (!zipPath) {
  console.log(`
🎨 SiteForge AI - Template Importer

Usage: node scripts/import-template.js <path-to-zip>

Example: node scripts/import-template.js ../saras-wine.zip
`);
  process.exit(1);
}

importTemplateZip(zipPath).catch(console.error);
