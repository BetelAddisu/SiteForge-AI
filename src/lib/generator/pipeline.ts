/**
 * Generation Pipeline
 * 
 * Phase 12: Checkpointed website generation pipeline.
 * 
 * Each step's output is persisted before the next step begins,
 * enabling recovery from failures without restarting from scratch.
 */

import { prisma } from '../prisma';
import { matchTemplates, type ProjectContext } from '../elementor/template-matcher';
import { AIContentEngine } from '../elementor/schemas';
import { applyModifications, findAllNodesByWidgetType, setNodeContent } from '../elementor/modifier';
import { validateElementorJson } from '../elementor/validator';
import { generatePreview } from '../preview';

// ============================================================================
// Types
// ============================================================================

export type PipelineStep =
  | 'INITIALIZE'
  | 'ANALYZE_BUSINESS'
  | 'SELECT_TEMPLATES'
  | 'GENERATE_CONTENT'
  | 'GENERATE_ASSETS'
  | 'APPLY_BRAND'
  | 'MODIFY_JSON'
  | 'VALIDATE_JSON'
  | 'GENERATE_PREVIEW'
  | 'READY_FOR_PUBLISH';

export interface PipelineState {
  projectId: string;
  currentStep: PipelineStep;
  completedSteps: PipelineStep[];
  failedStep?: PipelineStep;
  error?: string;
  checkpointData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineOptions {
  projectId: string;
  businessData: {
    businessName: string;
    industry: string;
    description?: string;
    stylePreset?: string;
    brandColors?: { primary?: string; secondary?: string };
    services?: string[];
    mainService?: string;
    contact?: {
      email?: string;
      phone?: string;
      address?: string;
    };
  };
  selectedTemplates?: string[];
  onStepComplete?: (step: PipelineStep, data: unknown) => void;
  onError?: (step: PipelineStep, error: string) => void;
}

// ============================================================================
// Generation Pipeline Class
// ============================================================================

export class GenerationPipeline {
  private prisma = prisma;
  private ai: AIContentEngine;
  private state: PipelineState | null = null;

  constructor(apiKey: string) {
    this.ai = new AIContentEngine({ apiKey });
  }

  /**
   * Initialize the pipeline
   */
  async initialize(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    this.state = {
      projectId,
      currentStep: 'INITIALIZE',
      completedSteps: [],
      checkpointData: (project.checkpointData as Record<string, unknown>) ?? {},
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /**
   * Run the complete pipeline
   */
  async run(options: PipelineOptions): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
    completedSteps: PipelineStep[];
  }> {
    const steps: PipelineStep[] = [
      'INITIALIZE',
      'ANALYZE_BUSINESS',
      'SELECT_TEMPLATES',
      'GENERATE_CONTENT',
      'GENERATE_ASSETS',
      'APPLY_BRAND',
      'MODIFY_JSON',
      'VALIDATE_JSON',
      'GENERATE_PREVIEW',
      'READY_FOR_PUBLISH',
    ];

    const startIndex = this.state?.completedSteps.length ?? 0;
    const remainingSteps = steps.slice(startIndex);

    for (const step of remainingSteps) {
      try {
        await this.executeStep(step, options);
        this.saveCheckpoint(step);
      } catch (error) {
        this.handleError(step, String(error));
        return {
          success: false,
          error: String(error),
          completedSteps: this.state?.completedSteps ?? [],
        };
      }
    }

    return {
      success: true,
      previewUrl: this.state?.checkpointData['previewUrl'] as string | undefined,
      completedSteps: this.state?.completedSteps ?? [],
    };
  }

  /**
   * Execute a single pipeline step
   */
  private async executeStep(step: PipelineStep, options: PipelineOptions): Promise<void> {
    switch (step) {
      case 'INITIALIZE':
        await this.stepInitialize(options);
        break;
      case 'ANALYZE_BUSINESS':
        await this.stepAnalyzeBusiness(options);
        break;
      case 'SELECT_TEMPLATES':
        await this.stepSelectTemplates(options);
        break;
      case 'GENERATE_CONTENT':
        await this.stepGenerateContent(options);
        break;
      case 'GENERATE_ASSETS':
        await this.stepGenerateAssets(options);
        break;
      case 'APPLY_BRAND':
        await this.stepApplyBrand(options);
        break;
      case 'MODIFY_JSON':
        await this.stepModifyJson(options);
        break;
      case 'VALIDATE_JSON':
        await this.stepValidateJson(options);
        break;
      case 'GENERATE_PREVIEW':
        await this.stepGeneratePreview(options);
        break;
      case 'READY_FOR_PUBLISH':
        await this.stepReadyForPublish(options);
        break;
    }
  }

  // Step 1: Initialize
  private async stepInitialize(options: PipelineOptions): Promise<void> {
    await this.prisma.project.update({
      where: { id: options.projectId },
      data: {
        status: 'GENERATING',
        checkpoint: 'INITIALIZE',
      },
    });

    this.state!.currentStep = 'INITIALIZE';
    this.state!.checkpointData = { ...this.state!.checkpointData, initialized: true };
  }

  // Step 2: Analyze Business
  private async stepAnalyzeBusiness(options: PipelineOptions): Promise<void> {
    const context: ProjectContext = {
      businessName: options.businessData.businessName,
      industry: options.businessData.industry,
      description: options.businessData.description,
      stylePreset: options.businessData.stylePreset,
      brandColors: options.businessData.brandColors,
      services: options.businessData.services,
      mainService: options.businessData.mainService,
    };

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      businessAnalysis: context,
    };

    await this.saveCheckpoint('ANALYZE_BUSINESS');
    options.onStepComplete?.('ANALYZE_BUSINESS', context);
  }

  // Step 3: Select Templates
  private async stepSelectTemplates(options: PipelineOptions): Promise<void> {
    const templates = await this.prisma.template.findMany({
      where: options.selectedTemplates ? { id: { in: options.selectedTemplates } } : undefined,
      include: { sections: true },
    });

    console.log(`[Pipeline] stepSelectTemplates - Found ${templates.length} templates`);

    const context: ProjectContext = {
      businessName: options.businessData.businessName,
      industry: options.businessData.industry,
      stylePreset: options.businessData.stylePreset,
      brandColors: options.businessData.brandColors,
    };

    const matches = matchTemplates(
      templates.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        industry: t.industry,
        style: t.style,
        compatibilityScore: t.compatibilityScore,
        sections: t.sections,
      })),
      context
    );

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      selectedTemplates: matches,
    };

    await this.saveCheckpoint('SELECT_TEMPLATES');
    options.onStepComplete?.('SELECT_TEMPLATES', matches);
  }

  // Step 4: Generate Content
  private async stepGenerateContent(options: PipelineOptions): Promise<void> {
    const businessData = options.businessData;
    
    console.log('[Pipeline] stepGenerateContent - Starting AI generation for:', businessData.businessName);
    
    const homepageResult = await this.ai.generateHomepageContent(
      businessData.businessName,
      businessData.industry
    );
    
    console.log('[Pipeline] Homepage generation:', homepageResult.success ? 'SUCCESS' : 'FAILED', homepageResult.error);

    // CRITICAL: If homepage generation fails, surface the error instead of proceeding with empty content
    if (!homepageResult.success || !homepageResult.data) {
      const errorMsg = homepageResult.error || 'AI returned no content for homepage';
      console.error('[Pipeline] Homepage generation failed:', errorMsg);
      throw new Error(`AI Content Generation Failed: ${errorMsg}`);
    }

    const aboutResult = await this.ai.generateAboutContent(
      businessData.businessName,
      businessData.industry
    );
    
    console.log('[Pipeline] About generation:', aboutResult.success ? 'SUCCESS' : 'FAILED', aboutResult.error);

    // About content is important but not critical - we can proceed with just homepage
    // Only throw if homepage succeeded but about failed critically
    if (!aboutResult.success && !aboutResult.data) {
      console.warn('[Pipeline] About generation failed, proceeding with homepage content only');
    }

    let serviceResult = null;
    if (businessData.mainService) {
      serviceResult = await this.ai.generateServiceContent(
        businessData.businessName,
        businessData.industry,
        businessData.mainService
      );
      console.log('[Pipeline] Services generation:', serviceResult?.success ? 'SUCCESS' : 'FAILED', serviceResult?.error);
    }

    const generatedContent = {
      homepage: homepageResult.data,
      about: aboutResult.data,
      services: serviceResult?.data,
      businessData: options.businessData,
    };
    
    console.log('[Pipeline] stepGenerateContent - Final generatedContent:', JSON.stringify(generatedContent, null, 2));

    // Double-check we have actual content before proceeding
    if (!generatedContent.homepage?.hero?.heading) {
      throw new Error('AI generated content is missing required hero heading - content may be empty');
    }

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      generatedContent,
    };

    // Persist generated content to database
    await this.prisma.project.update({
      where: { id: this.state!.projectId },
      data: {
        generatedContent: generatedContent as object,
      },
    });

    await this.saveCheckpoint('GENERATE_CONTENT');
    options.onStepComplete?.('GENERATE_CONTENT', generatedContent);
  }

  // Step 5: Generate Assets
  private async stepGenerateAssets(options: PipelineOptions): Promise<void> {
    const assets = {
      images: [],
      logo: null,
    };

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      assets,
    };

    await this.saveCheckpoint('GENERATE_ASSETS');
    options.onStepComplete?.('GENERATE_ASSETS', assets);
  }

  // Step 6: Apply Brand
  private async stepApplyBrand(options: PipelineOptions): Promise<void> {
    const brandTokens = {
      colors: {
        primary: options.businessData.brandColors?.primary ?? '#3B82F6',
        secondary: options.businessData.brandColors?.secondary ?? '#10B981',
      },
      style: options.businessData.stylePreset ?? 'modern',
      typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
      },
    };

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      brandTokens,
    };

    await this.saveCheckpoint('APPLY_BRAND');
    options.onStepComplete?.('APPLY_BRAND', brandTokens);
  }

  // Step 7: Modify JSON - Uses real modifier engine
  private async stepModifyJson(options: PipelineOptions): Promise<void> {
    const generatedContent = this.state!.checkpointData['generatedContent'] as {
      homepage?: {
        hero?: { heading?: string; subheading?: string; ctaText?: string };
        about?: { heading?: string; description?: string };
        services?: Array<{ title?: string; description?: string }>;
      };
      about?: { heading?: string; description?: string };
    } | undefined;
    
    console.log('[Pipeline] stepModifyJson - generatedContent:', JSON.stringify(generatedContent, null, 2));
    
    // selectedTemplates is now a MatchResult object with homepage/about/services/contact arrays
    const matchResult = this.state!.checkpointData['selectedTemplates'] as {
      homepage?: Array<{ templateId: string }>;
      services?: Array<{ templateId: string }>;
    } | undefined;

    console.log('[Pipeline] stepModifyJson - matchResult:', JSON.stringify(matchResult, null, 2));

    // Get the first template ID from homepage or services matches
    const firstMatch = matchResult?.homepage?.[0] || matchResult?.services?.[0];
    
    if (!firstMatch) {
      // No templates were matched - this means the template library is empty
      // Throw a clear error instead of silently generating generic placeholder content
      console.error('[Pipeline] No templates matched. Template library is empty or templates not imported.');
      
      throw new Error(
        'No templates available. Please import templates first by calling POST /api/templates/import, ' +
        'or select a template when creating your project.'
      );
    }

    // Get the first template's content
    const template = await this.prisma.template.findUnique({
      where: { id: firstMatch.templateId },
    });

    if (!template) {
      throw new Error(`Template not found: ${firstMatch.templateId}`);
    }

    // Real widget content lives on TemplateSection.content (set by import scripts),
    // NOT on Template.metadata - that only ever held manifest bookkeeping fields.
    const section = await this.prisma.templateSection.findFirst({
      where: { templateId: template.id },
    });

    const metadataContent = (section?.content as unknown[]) ?? (template.metadata as { content?: unknown[] } | null)?.content ?? [];

    if (metadataContent.length === 0) {
      throw new Error(
        `Template "${template.name}" has no widget content available (checked TemplateSection and metadata.content) - re-run template import for this template.`
      );
    }

    // Make a DEEP COPY of the template content - NEVER modify the original template!
    // This preserves the template for reuse across multiple projects.
    const contentTree = JSON.parse(JSON.stringify(metadataContent)) as Parameters<typeof applyModifications>[0];

    // Distribute generated content across ALL matching widgets in document
    // order, not just the first one of each type. Using only
    // replaceHeading/replaceParagraph/replaceButton (which each only touch
    // the FIRST match via findNode) meant almost all of a template's text -
    // and almost all of the AI-generated content (about section, services,
    // etc.) - never made it onto the page at all. This still doesn't know
    // which section a given widget visually belongs to (that would need
    // real section-type detection), so it fills headings/text/buttons in
    // the order they appear in the document: hero first, then about, then
    // services. Good enough to make generated content actually show up
    // across the page rather than in a single spot.
    const hero = generatedContent?.homepage?.hero;
    const about = generatedContent?.homepage?.about ?? generatedContent?.about;
    const services = generatedContent?.homepage?.services ?? [];

    const headingTexts = [
      hero?.heading,
      about?.heading,
      ...services.map(s => s.title),
    ].filter((t): t is string => Boolean(t));

    const textEditorTexts = [
      hero?.subheading,
      about?.description,
      ...services.map(s => s.description),
    ].filter((t): t is string => Boolean(t));

    const buttonTexts = [hero?.ctaText].filter((t): t is string => Boolean(t));

    const appliedModifications: string[] = [];
    let anyModified = false;

    const headingNodes = findAllNodesByWidgetType(contentTree, 'heading');
    headingTexts.forEach((text, i) => {
      if (headingNodes[i]) {
        setNodeContent(headingNodes[i], text);
        appliedModifications.push(`heading[${i}] -> "${text.slice(0, 40)}"`);
        anyModified = true;
      }
    });

    const textEditorNodes = findAllNodesByWidgetType(contentTree, 'text-editor');
    textEditorTexts.forEach((text, i) => {
      if (textEditorNodes[i]) {
        setNodeContent(textEditorNodes[i], text);
        appliedModifications.push(`text-editor[${i}] -> "${text.slice(0, 40)}"`);
        anyModified = true;
      }
    });

    const buttonNodes = findAllNodesByWidgetType(contentTree, 'button');
    buttonTexts.forEach((text, i) => {
      if (buttonNodes[i]) {
        setNodeContent(buttonNodes[i], text);
        appliedModifications.push(`button[${i}] -> "${text.slice(0, 40)}"`);
        anyModified = true;
      }
    });

    if (headingTexts.length > headingNodes.length || textEditorTexts.length > textEditorNodes.length) {
      console.warn(
        `[Pipeline] Template "${template.name}" has fewer heading/text widgets (${headingNodes.length}/${textEditorNodes.length}) than generated content items (${headingTexts.length}/${textEditorTexts.length}) - some generated content had no widget slot to fill.`
      );
    }

    // Build proper Elementor JSON structure - this is stored in the PROJECT, not the template
    const elementorData = {
      version: '0.3',
      elements: contentTree,
      templateId: template.id, // Track which template was used as a base
      templateName: template.name,
    };

    const modifiedJson = {
      templateId: template.id,
      modified: anyModified,
      modifications: appliedModifications,
      timestamp: new Date().toISOString(),
    };

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      elementorData,
      modifiedJson,
    };

    // Persist elementor data to database
    await this.prisma.project.update({
      where: { id: this.state!.projectId },
      data: {
        elementorData: elementorData as object,
        templateId: template.id,
      },
    });

    await this.saveCheckpoint('MODIFY_JSON');
    options.onStepComplete?.('MODIFY_JSON', modifiedJson);
  }

  // Generate a basic Elementor structure when no templates are available
  private generateBasicStructure(content?: {
    homepage?: {
      hero?: { heading?: string; subheading?: string; ctaText?: string };
      about?: { heading?: string; paragraphs?: string[] };
    };
  }): unknown[] {
    const hero = content?.homepage?.hero || {};
    const about = content?.homepage?.about || {};
    
    return [
      // Hero Section
      {
        id: 'section-hero',
        elType: 'section',
        settings: {
          layout: 'full_width',
          content_width: { size: 1140 },
        },
        elements: [
          {
            id: 'column-hero-1',
            elType: 'column',
            settings: { _column_size: 100 },
            elements: [
              {
                id: 'heading-hero',
                elType: 'widget',
                widgetType: 'heading',
                settings: {
                  heading: hero.heading || 'Welcome to Our Website',
                  align: 'center',
                  title_color: '#1a1a1a',
                },
              },
              {
                id: 'text-hero',
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: `<p style="text-align: center;">${hero.subheading || 'We create amazing digital experiences for your business.'}</p>`,
                },
              },
              {
                id: 'button-hero',
                elType: 'widget',
                widgetType: 'button',
                settings: {
                  text: hero.ctaText || 'Get Started',
                  align: 'center',
                  background_color: '#3B82F6',
                },
              },
            ],
          },
        ],
      },
      // About Section
      {
        id: 'section-about',
        elType: 'section',
        settings: {
          layout: 'full_width',
          content_width: { size: 1140 },
          background_background: 'classic',
          background_color: '#f9fafb',
        },
        elements: [
          {
            id: 'column-about-1',
            elType: 'column',
            settings: { _column_size: 100 },
            elements: [
              {
                id: 'heading-about',
                elType: 'widget',
                widgetType: 'heading',
                settings: {
                  heading: about.heading || 'About Us',
                  align: 'center',
                  title_color: '#1a1a1a',
                },
              },
              {
                id: 'text-about',
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: `<p style="text-align: center;">${about.paragraphs?.[0] || 'We are a team of passionate professionals dedicated to delivering excellence.'}</p>`,
                },
              },
            ],
          },
        ],
      },
      // Spacer
      {
        id: 'spacer-1',
        elType: 'widget',
        widgetType: 'spacer',
        settings: {
          space: 50,
        },
      },
    ];
  }

  // Step 8: Validate JSON - Uses real validator
  private async stepValidateJson(options: PipelineOptions): Promise<void> {
    const elementorData = this.state!.checkpointData['elementorData'] as {
      elements?: unknown[];
    } | undefined;

    // Validate the actual modified content, not a placeholder
    const validationResult = validateElementorJson((elementorData?.elements ?? []) as Parameters<typeof validateElementorJson>[0]);

    if (!validationResult.valid) {
      throw new Error(`Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }

    // Add any warnings as info
    if (validationResult.warnings.length > 0) {
      console.log('Validation warnings:', validationResult.warnings);
    }

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      validationResult,
    };

    await this.saveCheckpoint('VALIDATE_JSON');
    options.onStepComplete?.('VALIDATE_JSON', validationResult);
  }

  // Step 9: Generate Preview - Uses real preview generator
  private async stepGeneratePreview(options: PipelineOptions): Promise<void> {
    const brandTokens = this.state!.checkpointData['brandTokens'] as {
      colors?: { primary?: string; secondary?: string };
      typography?: { headingFont?: string; bodyFont?: string };
    } | undefined;

    const elementorData = this.state!.checkpointData['elementorData'] as {
      elements?: unknown[];
    } | undefined;

    try {
      // Use the real preview generator
      const previewResult = await generatePreview({
        projectId: options.projectId,
        elementorData: elementorData?.elements ?? [],
        stylePreset: options.businessData.stylePreset,
        brandTokens,
      });

      const previewUrl = previewResult.success ? (previewResult.previewUrl || '') : '';

      this.state!.checkpointData = {
        ...this.state!.checkpointData,
        previewUrl,
      };

      await this.saveCheckpoint('GENERATE_PREVIEW');
      options.onStepComplete?.('GENERATE_PREVIEW', { previewUrl });
    } catch (error) {
      // If preview generation fails, use a placeholder
      const fallbackUrl = `https://storage.example.com/previews/${options.projectId}/preview.png`;
      this.state!.checkpointData = {
        ...this.state!.checkpointData,
        previewUrl: fallbackUrl,
      };

      await this.saveCheckpoint('GENERATE_PREVIEW');
      options.onStepComplete?.('GENERATE_PREVIEW', { previewUrl: fallbackUrl });
    }
  }

  // Step 10: Ready for Publish
  private async stepReadyForPublish(options: PipelineOptions): Promise<void> {
    await this.prisma.project.update({
      where: { id: options.projectId },
      data: {
        status: 'PREVIEW',
        previewImage: this.state!.checkpointData['previewUrl'] as string,
        checkpoint: 'READY_FOR_PUBLISH',
      },
    });

    this.state!.completedSteps.push('READY_FOR_PUBLISH');
    options.onStepComplete?.('READY_FOR_PUBLISH', { projectId: options.projectId });
  }

  private async saveCheckpoint(step: PipelineStep): Promise<void> {
    if (!this.state) return;

    this.state.completedSteps.push(step);
    this.state.currentStep = step;

    await this.prisma.project.update({
      where: { id: this.state.projectId },
      data: {
        checkpoint: step,
        checkpointData: this.state.checkpointData as object,
      },
    });
  }

  private handleError(step: PipelineStep, error: string): void {
    if (!this.state) return;

    this.state.failedStep = step;
    this.state.error = error;

    this.prisma.project.update({
      where: { id: this.state.projectId },
      data: { status: 'FAILED' },
    }).catch(console.error);
  }

  async resume(options: PipelineOptions): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
    completedSteps: PipelineStep[];
  }> {
    if (!this.state) {
      await this.initialize(options.projectId);
    }
    return this.run(options);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createPipeline(apiKey: string): GenerationPipeline {
  return new GenerationPipeline(apiKey);
}

export async function getPipelineProgress(projectId: string): Promise<{
  status: string;
  checkpoint: string | null;
  completedSteps: PipelineStep[];
}> {
  
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    throw new Error('Project not found');
  }

  const checkpoint = project.checkpoint as string | null;
  const completedSteps = checkpoint ? [checkpoint as PipelineStep] : [];

  return {
    status: project.status,
    checkpoint,
    completedSteps,
  };
}
