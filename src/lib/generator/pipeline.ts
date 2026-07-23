/**
 * Generation Pipeline
 * 
 * Simplified website generation pipeline.
 * Always generates a working website, even without templates or AI.
 */

import { prisma } from '../prisma';
import { matchTemplates, type ProjectContext } from '../elementor/template-matcher';
import { AIContentEngine } from '../elementor/schemas';
import { findAllNodesByWidgetType, setNodeContent } from '../elementor/modifier';
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
   * Run the complete pipeline - simplified to always succeed
   */
  async run(options: PipelineOptions): Promise<{
    success: boolean;
    previewUrl?: string;
    error?: string;
    completedSteps: PipelineStep[];
  }> {
    try {
      console.log('[Pipeline] Starting generation for project:', options.projectId);
      
      // Step 1: Initialize
      await this.stepInitialize(options);
      
      // Step 2: Generate content (try AI, fall back to basic content)
      await this.stepGenerateContent(options);
      
      // Step 3: Find or create template
      await this.stepSelectTemplates(options);
      
      // Step 4: Apply brand
      await this.stepApplyBrand(options);
      
      // Step 5: Create the Elementor structure
      await this.stepCreateElementorStructure(options);
      
      // Step 6: Validate
      await this.stepValidateJson(options);
      
      // Step 7: Generate preview
      await this.stepGeneratePreview(options);
      
      // Step 8: Mark as ready
      await this.stepReadyForPublish(options);
      
      console.log('[Pipeline] Generation complete!');
      
      return {
        success: true,
        previewUrl: this.state?.checkpointData['previewUrl'] as string | undefined,
        completedSteps: this.state?.completedSteps ?? [],
      };
    } catch (error) {
      console.error('[Pipeline] Generation failed:', error);
      return {
        success: false,
        error: String(error),
        completedSteps: this.state?.completedSteps ?? [],
      };
    }
  }

  /**
   * Execute a single pipeline step (for resume functionality)
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
      case 'APPLY_BRAND':
        await this.stepApplyBrand(options);
        break;
      case 'MODIFY_JSON':
        await this.stepCreateElementorStructure(options);
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

  // Step 3: Select Templates - simplified to always work
  private async stepSelectTemplates(options: PipelineOptions): Promise<void> {
    console.log('[Pipeline] stepSelectTemplates - Looking for templates...');
    
    // Get templates from database
    const templates = await this.prisma.template.findMany({
      where: options.selectedTemplates ? { id: { in: options.selectedTemplates } } : undefined,
      include: { sections: true },
    });

    console.log(`[Pipeline] Found ${templates.length} templates in database`);

    let templateToUse = null;
    let templateContent: unknown[] = [];

    if (templates.length > 0) {
      // Find the best matching template
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

      // Use the first matched template
      const firstMatch = matches.homepage?.[0] || matches.services?.[0];
      if (firstMatch) {
        templateToUse = templates.find(t => t.id === firstMatch.templateId);
        if (templateToUse) {
          // Get template content from sections
          const section = await this.prisma.templateSection.findFirst({
            where: { templateId: templateToUse.id },
          });
          templateContent = (section?.content as unknown[]) ?? [];
          console.log(`[Pipeline] Template: ${templateToUse.name}, section content length: ${templateContent.length}`);
        }
      }

      // If no match, use the first template
      if (!templateToUse && templates.length > 0) {
        templateToUse = templates[0];
        const section = await this.prisma.templateSection.findFirst({
          where: { templateId: templateToUse.id },
        });
        templateContent = (section?.content as unknown[]) ?? [];
        console.log(`[Pipeline] Using first template: ${templateToUse.name}, section content length: ${templateContent.length}`);
      }

      this.state!.checkpointData = {
        ...this.state!.checkpointData,
        selectedTemplates: matches,
        templateToUse,
        templateContent,
      };
    } else {
      console.log('[Pipeline] No templates found - will generate basic structure');
      this.state!.checkpointData = {
        ...this.state!.checkpointData,
        selectedTemplates: null,
        templateToUse: null,
        templateContent: [],
      };
    }

    await this.saveCheckpoint('SELECT_TEMPLATES');
  }

  // Step 2: Generate Content - with graceful fallback
  private async stepGenerateContent(options: PipelineOptions): Promise<void> {
    const businessData = options.businessData;
    
    console.log('[Pipeline] stepGenerateContent - Starting for:', businessData.businessName);
    
    // Start with basic content
    let generatedContent = {
      homepage: {
        hero: {
          heading: businessData.businessName,
          subheading: `${businessData.industry} services`,
          ctaText: 'Learn More',
        },
        about: {
          heading: `About ${businessData.businessName}`,
          description: businessData.description || `Professional ${businessData.industry} services`,
        },
        services: [] as Array<{ title: string; description: string }>,
      },
      businessData: options.businessData,
    };

    // Try AI generation, but don't fail if it doesn't work
    try {
      const homepageResult = await this.ai.generateHomepageContent(
        businessData.businessName,
        businessData.industry
      );
      
      console.log('[Pipeline] Homepage AI generation:', homepageResult.success ? 'SUCCESS' : 'FAILED');
      
      if (homepageResult.success && homepageResult.data) {
        // Merge AI content with defaults to ensure all required fields exist
        const aiData = homepageResult.data;
        generatedContent.homepage = {
          hero: {
            heading: aiData.hero.heading,
            subheading: aiData.hero.subheading || `${businessData.businessName} - Professional Services`,
            ctaText: aiData.hero.ctaText || 'Learn More',
          },
          about: {
            heading: aiData.about.heading,
            description: aiData.about.paragraphs?.join(' ') || aiData.about.heading,
          },
          services: (aiData.services || []).map(s => ({
            title: s.title,
            description: s.description,
          })),
        };
        console.log('[Pipeline] Using AI-generated content');
      } else {
        console.log('[Pipeline] Using basic content (AI failed)');
      }
    } catch (error) {
      console.warn('[Pipeline] AI generation failed, using basic content:', error);
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

  // Step 5: Create Elementor Structure - works with or without templates
  private async stepCreateElementorStructure(options: PipelineOptions): Promise<void> {
    const generatedContent = this.state!.checkpointData['generatedContent'] as {
      homepage?: {
        hero?: { heading?: string; subheading?: string; ctaText?: string };
        about?: { heading?: string; description?: string };
        services?: Array<{ title?: string; description?: string }>;
      };
    } | undefined;
    
    const templateToUse = this.state!.checkpointData['templateToUse'] as {
      id: string;
      name: string;
    } | null;
    const templateContent = this.state!.checkpointData['templateContent'] as unknown[];

    console.log('[Pipeline] stepCreateElementorStructure - Template:', templateToUse?.name || 'None');

    let contentTree: unknown[];

    if (templateContent.length > 0) {
      // Use template content and fill in generated content
      contentTree = JSON.parse(JSON.stringify(templateContent));
      
      const hero = generatedContent?.homepage?.hero;
      const about = generatedContent?.homepage?.about;
      const services = generatedContent?.homepage?.services ?? [];

      // Collect all texts to distribute
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

      // Find and fill all widgets
      const headingNodes = findAllNodesByWidgetType(contentTree as Parameters<typeof findAllNodesByWidgetType>[0], 'heading');
      headingTexts.forEach((text, i) => {
        if (headingNodes[i]) {
          setNodeContent(headingNodes[i], text);
        }
      });

      const textEditorNodes = findAllNodesByWidgetType(contentTree as Parameters<typeof findAllNodesByWidgetType>[0], 'text-editor');
      textEditorTexts.forEach((text, i) => {
        if (textEditorNodes[i]) {
          setNodeContent(textEditorNodes[i], text);
        }
      });

      const buttonNodes = findAllNodesByWidgetType(contentTree as Parameters<typeof findAllNodesByWidgetType>[0], 'button');
      buttonTexts.forEach((text, i) => {
        if (buttonNodes[i]) {
          setNodeContent(buttonNodes[i], text);
        }
      });
    } else {
      // Generate basic structure from scratch
      contentTree = this.generateBasicStructure(generatedContent);
    }

    // Build Elementor data structure
    const elementorData = {
      version: '0.3',
      elements: contentTree,
      templateId: templateToUse?.id || null,
      templateName: templateToUse?.name || 'Generated',
    };

    console.log('[Pipeline] Saving elementorData with', contentTree.length, 'top-level elements');
    console.log('[Pipeline] First element:', JSON.stringify(contentTree[0], null, 2).slice(0, 500));

    this.state!.checkpointData = {
      ...this.state!.checkpointData,
      elementorData,
    };

    // Persist to database
    await this.prisma.project.update({
      where: { id: this.state!.projectId },
      data: {
        elementorData: elementorData as object,
        templateId: templateToUse?.id || null,
      },
    });

    console.log('[Pipeline] Saved elementorData to project', this.state!.projectId);

    await this.saveCheckpoint('MODIFY_JSON');
  }

  // Generate a basic Elementor structure when no templates are available
  private generateBasicStructure(content?: {
    homepage?: {
      hero?: { heading?: string; subheading?: string; ctaText?: string };
      about?: { heading?: string; description?: string };
      services?: Array<{ title?: string; description?: string }>;
    };
  }): unknown[] {
    const hero = content?.homepage?.hero || {
      heading: 'Welcome',
      subheading: 'Professional services for your business',
      ctaText: 'Get Started',
    };
    const about = content?.homepage?.about || {
      heading: 'About Us',
      description: 'We provide excellent services to our clients.',
    };
    const services = content?.homepage?.services || [];
    
    const elements: unknown[] = [
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
                  heading: hero.heading,
                  align: 'center',
                  title_color: '#1a1a1a',
                },
              },
              {
                id: 'text-hero',
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: `<p style="text-align: center;">${hero.subheading}</p>`,
                },
              },
              {
                id: 'button-hero',
                elType: 'widget',
                widgetType: 'button',
                settings: {
                  text: hero.ctaText,
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
                  heading: about.heading,
                  align: 'center',
                  title_color: '#1a1a1a',
                },
              },
              {
                id: 'text-about',
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: `<p style="text-align: center;">${about.description}</p>`,
                },
              },
            ],
          },
        ],
      },
    ];

    // Add services section if we have services
    if (services.length > 0) {
      elements.push({
        id: 'section-services',
        elType: 'section',
        settings: {
          layout: 'full_width',
          content_width: { size: 1140 },
        },
        elements: [
          {
            id: 'column-services-1',
            elType: 'column',
            settings: { _column_size: 100 },
            elements: [
              {
                id: 'heading-services',
                elType: 'widget',
                widgetType: 'heading',
                settings: {
                  heading: 'Our Services',
                  align: 'center',
                  title_color: '#1a1a1a',
                },
              },
              ...services.slice(0, 3).map((service, index) => ({
                id: `text-service-${index}`,
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: `<h3>${service.title}</h3><p>${service.description}</p>`,
                },
              })),
            ],
          },
        ],
      });
    }

    return elements;
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
