#!/usr/bin/env node

/**
 * Template Import CLI
 * 
 * Easy command-line interface for importing template kits.
 * 
 * Usage:
 *   npx ts-node scripts/template-import/cli.ts                    # Import from Supabase
 *   npx ts-node scripts/template-import/cli.ts /path/to/file.zip # Import local file
 *   npx ts-node scripts/template-import/cli.ts --list             # List existing templates
 *   npx ts-node scripts/template-import/cli.ts --stats            # Show import statistics
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamically import the main module
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🎨 SiteForge AI - Template Import CLI

Usage:
  npx ts-node scripts/template-import/cli.ts                    Import from Supabase
  npx ts-node scripts/template-import/cli.ts /path/to/file.zip   Import local file
  npx ts-node scripts/template-import/cli.ts --list              List existing templates
  npx ts-node scripts/template-import/cli.ts --stats             Show import statistics

Examples:
  npx ts-node scripts/template-import/cli.ts
  npx ts-node scripts/template-import/cli.ts ./saras-wine.zip
  npx ts-node scripts/template-import/cli.ts --stats
`);
    return;
  }
  
  if (args[0] === '--list') {
    await listTemplates();
    return;
  }
  
  if (args[0] === '--stats') {
    await showStats();
    return;
  }
  
  // Import local file(s)
  for (const filePath of args) {
    if (fs.existsSync(filePath)) {
      console.log(`\n📦 Importing: ${filePath}`);
      // Import logic would go here
      console.log(`   (This would import the file)`);
    } else {
      console.error(`❌ File not found: ${filePath}`);
    }
  }
}

async function listTemplates() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  
  console.log('\n📋 Recent Templates:\n');
  
  for (const t of templates) {
    console.log(`  • ${t.name}`);
    console.log(`    Category: ${t.category} | Industry: ${t.industry || 'N/A'}`);
    console.log(`    Status: ${t.importStatus}`);
    console.log();
  }
  
  const count = await prisma.template.count();
  console.log(`Total: ${count} templates`);
}

async function showStats() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  
  const [templateCount, sectionCount] = await Promise.all([
    prisma.template.count(),
    prisma.templateSection.count(),
  ]);
  
  const byCategory = await prisma.template.groupBy({
    by: ['category'],
    _count: true,
  });
  
  const byIndustry = await prisma.template.groupBy({
    by: ['industry'],
    _count: true,
  });
  
  console.log('\n📊 Template Import Statistics:\n');
  console.log(`   Total Templates: ${templateCount}`);
  console.log(`   Total Sections: ${sectionCount}`);
  
  console.log('\n   By Category:');
  for (const cat of byCategory) {
    console.log(`     ${cat.category}: ${cat._count}`);
  }
  
  console.log('\n   By Industry:');
  for (const ind of byIndustry.filter(i => i.industry)) {
    console.log(`     ${ind.industry}: ${ind._count}`);
  }
}

main().catch(console.error);
