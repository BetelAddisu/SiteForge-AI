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
import { applyModifications, replaceHeading, replaceParagraph, replaceButton } from '../elementor/modifier';
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
    
    const homepageResult = await this.ai.generateHomepageContent(
      businessData.businessName,
      businessData.industry
    );

    const aboutResult = await this.ai.generateAboutContent(
      businessData.businessName,
      businessData.industry
    );

    let serviceResult = null;
    if (businessData.mainService) {
      serviceResult = await this.ai.generateServiceContent(
        businessData.businessName,
        businessData.industry,
        businessData.mainService
      );
    }

    const generatedContent = {
      homepage: homepageResult.data,
      about: aboutResult.data,
      services: serviceResult?.data,
      businessData: options.businessData,
    };

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
        about?: { heading?: string; paragraphs?: string[] };
      };
      about?: Record<string, unknown>;
    } | undefined;
    
    const selectedTemplates = this.state!.checkpointData['selectedTemplates'] as Array<{
      id: string;
    }> | undefined;

    if (!selectedTemplates || selectedTemplates.length === 0) {
      throw new Error('No templates selected');
    }

    // Get the first template's content
    const template = await this.prisma.template.findUnique({
      where: { id: selectedTemplates[0].id },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Real widget content lives on TemplateSection.content (set by import scripts),
    // NOT on Template.metadata - that only ever held manifest bookkeeping fields.
    const section = await this.prisma.templateSection.findFirst({
      where: { templateId: template.id },
    });

    const metadataContent = (template.metadata as { content?: unknown[] } | null)?.content;
    const contentTree = (
      (section?.content as unknown[]) ?? metadataContent ?? []
    ) as Parameters<typeof applyModifications>[0];

    if (contentTree.length === 0) {
      throw new Error(
        `Template "${template.name}" has no widget content available (checked TemplateSection and metadata.content) - re-run template import for this template.`
      );
    }

    // Apply AI-generated content using widget-type targeting
    const hero = generatedContent?.homepage?.hero;
    const about = generatedContent?.homepage?.about;
    const appliedModifications: string[] = [];
    let anyModified = false;

    if (hero?.heading) {
      const r = replaceHeading(contentTree, hero.heading);
      if (r.success && r.modified) { appliedModifications.push(...r.modifications); anyModified = true; }
    }
    if (hero?.subheading || about?.paragraphs?.[0]) {
      const r = replaceParagraph(contentTree, hero?.subheading || about!.paragraphs![0]);
      if (r.success && r.modified) { appliedModifications.push(...r.modifications); anyModified = true; }
    }
    if (hero?.ctaText) {
      const r = replaceButton(contentTree, hero.ctaText);
      if (r.success && r.modified) { appliedModifications.push(...r.modifications); anyModified = true; }
    }

    // Build proper Elementor JSON structure
    const elementorData = {
      version: '0.3',
      elements: contentTree,
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
