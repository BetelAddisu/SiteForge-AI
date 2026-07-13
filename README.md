# SiteForge AI

AI-powered website generation from Elementor templates.

## Overview

SiteForge AI transforms a 700+ Elementor template library into an AI-powered website production system. Users can:
- Browse and search a template library
- Create projects with business information
- Generate AI-powered content
- Customize templates with brand assets
- Publish directly to WordPress

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm or npm
- Supabase account (for auth and storage)
- Gemini API key (for AI content generation)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/siteforge-ai.git
cd siteforge-ai

# Install dependencies
cd siteforge-ai
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up the database
npx prisma generate
npx prisma db push
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
siteforge-ai/
├── prisma/           # Database schema
├── scripts/          # Build and import scripts
├── src/
│   ├── app/          # Next.js app router pages
│   │   ├── (auth)/  # Auth pages (login, register)
│   │   └── (dashboard)/ # Dashboard pages
│   ├── components/   # Reusable UI components
│   │   ├── ui/      # shadcn/ui primitives
│   │   └── layout/  # Layout components
│   ├── features/     # Feature modules
│   └── lib/          # Core libraries
│       ├── elementor/ # Elementor parsing/modification
│       ├── database/ # Supabase client
│       └── prisma/   # Prisma client
└── scripts/          # CLI scripts
    └── bulk-import.ts # Template bulk import
```

## Features

### Phase 0: Feasibility Spike
- Elementor template parsing
- Widget compatibility analysis
- AI content generation testing

### Phase 1-2: Foundation
- Next.js 15 with TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth + Prisma

### Phase 3A-3C: Template Processing
- Bulk template import
- Compatibility analysis
- Widget repair engine

### Phase 4-5: Core UI
- Template library with search/filter
- Project creation wizard

### Phase 6-8: AI Features
- Content generation with Gemini
- Template matching
- JSON modification & validation

### Phase 9-12: Generation
- Brand system
- Media engine
- Business info mining
- Generation pipeline

### Phase 13-15: Output
- WordPress connection
- Preview system
- Admin dashboard

## Scripts

```bash
# Bulk import templates
npx tsx scripts/bulk-import.ts --source ./templates --batch-size 10

# Phase 0 testing
cd scripts/phase0
npx tsx parse-elementor.ts ./sample-templates/template.zip
npx tsx test-ai-replacement.ts
```

## Documentation

See [scripts/phase0/FINDINGS.md](./scripts/phase0/FINDINGS.md) for Phase 0 technical findings.

## License

MIT