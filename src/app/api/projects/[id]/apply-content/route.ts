import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/database/server-supabase';
import { findAllNodesByWidgetType, setNodeContent } from '@/lib/elementor/modifier';
import { classifySections } from '@/lib/elementor/section-classifier';
import type { ElementorNode } from '@/lib/elementor/parser';
import { validateElementorJson } from '@/lib/elementor/validator';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
    if (!appUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await prisma.project.findFirst({ where: { id, userId: appUser.id } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.templateId) return NextResponse.json({ error: 'No template selected. Generate the website first.' }, { status: 400 });
    if (!project.generatedContent) return NextResponse.json({ error: 'No content to apply.' }, { status: 400 });

    const template = await prisma.template.findUnique({ where: { id: project.templateId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Real widget content lives on TemplateSection.content (set by import scripts),
    // NOT on Template.metadata - that only ever held manifest bookkeeping.
    const section = await prisma.templateSection.findFirst({ where: { templateId: template.id } });
    const sourceContent = (section?.content as unknown[]) ?? (template.metadata as { content?: unknown[] } | null)?.content ?? [];

    if (sourceContent.length === 0) {
      return NextResponse.json(
        { error: `Template "${template.name}" has no widget content available. Re-run template import for this template.` },
        { status: 422 }
      );
    }

    // Make a DEEP COPY - we never modify the original template!
    // This preserves the template for reuse across multiple projects.
    const contentTree = JSON.parse(JSON.stringify(sourceContent)) as ElementorNode[];

    const generatedContent = project.generatedContent as {
      homepage?: {
        hero?: { heading?: string; subheading?: string; ctaText?: string };
        about?: { heading?: string; paragraphs?: string[] };
        services?: Array<{ title?: string; description?: string }>;
      };
    };
    const hero = generatedContent.homepage?.hero;
    const about = generatedContent.homepage?.about;
    const services = generatedContent.homepage?.services ?? [];
    const aboutDescription = about?.paragraphs?.[0];

    // Classify sections by role and fill within each section only - matches
    // the same strategy used in the generation pipeline (see pipeline.ts
    // stepCreateElementorStructure), so edits here behave the same way
    // edits made during generation do, and don't bleed content into
    // sections they don't belong in.
    const appliedModifications: string[] = [];
    const classified = classifySections(contentTree);

    const heroSection = classified.find(c => c.role === 'hero');
    if (heroSection) {
      const headings = findAllNodesByWidgetType(heroSection.node.elements || [], 'heading');
      if (headings[0] && hero?.heading) { setNodeContent(headings[0], hero.heading); appliedModifications.push('hero heading'); }

      const textEditors = findAllNodesByWidgetType(heroSection.node.elements || [], 'text-editor');
      if (textEditors[0] && hero?.subheading) { setNodeContent(textEditors[0], hero.subheading); appliedModifications.push('hero subheading'); }

      const buttons = findAllNodesByWidgetType(heroSection.node.elements || [], 'button');
      if (buttons[0] && hero?.ctaText) { setNodeContent(buttons[0], hero.ctaText); appliedModifications.push('hero CTA'); }
    }

    const aboutSection = classified.find(c => c.role === 'about');
    if (aboutSection) {
      const headings = findAllNodesByWidgetType(aboutSection.node.elements || [], 'heading');
      if (headings[0] && about?.heading) { setNodeContent(headings[0], about.heading); appliedModifications.push('about heading'); }

      const textEditors = findAllNodesByWidgetType(aboutSection.node.elements || [], 'text-editor');
      if (textEditors[0] && aboutDescription) { setNodeContent(textEditors[0], aboutDescription); appliedModifications.push('about description'); }
    }

    const servicesSection = classified.find(c => c.role === 'services');
    if (servicesSection && services.length > 0) {
      const headings = findAllNodesByWidgetType(servicesSection.node.elements || [], 'heading');
      const textEditors = findAllNodesByWidgetType(servicesSection.node.elements || [], 'text-editor');

      services.forEach((service, i) => {
        if (headings[i] && service.title) { setNodeContent(headings[i], service.title); appliedModifications.push(`service[${i}] title`); }
        if (textEditors[i] && service.description) { setNodeContent(textEditors[i], service.description); appliedModifications.push(`service[${i}] description`); }
      });
    }

    const validation = validateElementorJson(contentTree);
    if (!validation.valid) return NextResponse.json({ error: `Validation failed: ${validation.errors.map(e => e.message).join(', ')}` }, { status: 422 });

    await prisma.project.update({ where: { id }, data: { elementorData: { version: '0.3', elements: contentTree } as object } });
    return NextResponse.json({ success: true, modifications: appliedModifications });
  } catch (error) {
    console.error('Error applying content:', error);
    return NextResponse.json({ error: 'Failed to apply content' }, { status: 500 });
  }
}
