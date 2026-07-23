/**
 * AI Content Engine
 * 
 * Phase 6: AI-powered content generation using Gemini.
 * 
 * Features:
 * - Zod schema validation for all outputs
 * - Structured content generation (homepage, about, services, etc.)
 * - AI usage logging for cost tracking
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Schema } from '@google/genai';
import { z } from 'zod';
import { zodToGeminiSchema } from './zod-to-gemini';

// ============================================================================
// Schemas
// ============================================================================

export const ContentReplacementSchema = z.object({
  heading: z.string().min(1).max(200).describe('Replacement heading text'),
  subheading: z.string().max(300).optional().describe('Optional subheading'),
  paragraphs: z.array(z.string().min(10).max(1000)).min(1).max(5),
  callToAction: z.object({
    text: z.string().min(1).max(50),
    url: z.string().url().optional(),
  }).optional(),
  suggestedColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional(),
});

export const HomepageContentSchema = z.object({
  hero: z.object({
    heading: z.string().min(1).max(200),
    subheading: z.string().max(400).optional(),
    ctaText: z.string().max(50).optional(),
  }),
  about: z.object({
    heading: z.string().min(1).max(200),
    paragraphs: z.array(z.string().min(50).max(800)).min(1).max(3),
  }),
  services: z.array(z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(20).max(500),
    icon: z.string().max(50).optional(),
  })).min(1).max(6),
  testimonials: z.array(z.object({
    quote: z.string().min(20).max(500),
    author: z.string().min(1).max(100),
    role: z.string().max(100).optional(),
  })).max(3).optional(),
});

export const AboutPageContentSchema = z.object({
  heading: z.string().min(1).max(200),
  subheading: z.string().max(400).optional(),
  story: z.array(z.string().min(50).max(1000)).min(2).max(4),
  mission: z.string().min(20).max(500),
  values: z.array(z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(20).max(300),
  })).min(2).max(5),
  team: z.array(z.object({
    name: z.string().min(1).max(100),
    role: z.string().max(100),
    bio: z.string().max(300).optional(),
  })).max(6).optional(),
});

export const ServiceContentSchema = z.object({
  heading: z.string().min(1).max(200),
  description: z.string().min(50).max(1000),
  features: z.array(z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(20).max(300),
  })).min(2).max(8),
  pricing: z.object({
    heading: z.string().max(100).optional(),
    tiers: z.array(z.object({
      name: z.string().min(1).max(50),
      price: z.string().max(50),
      features: z.array(z.string().max(100)),
      recommended: z.boolean().optional(),
    })).min(1).max(4),
  }).optional(),
});

export const SEOContentSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().max(50)).min(5).max(15),
  ogImage: z.object({
    suggestion: z.string().max(200),
    alt: z.string().max(100),
  }).optional(),
});

export const ImageAltTextSchema = z.object({
  alt: z.string().min(5).max(125),
  description: z.string().max(200).optional(),
});

// Type exports
export type ContentReplacement = z.infer<typeof ContentReplacementSchema>;
export type HomepageContent = z.infer<typeof HomepageContentSchema>;
export type AboutPageContent = z.infer<typeof AboutPageContentSchema>;
export type ServiceContent = z.infer<typeof ServiceContentSchema>;
export type SEOContent = z.infer<typeof SEOContentSchema>;
export type ImageAltText = z.infer<typeof ImageAltTextSchema>;

// ============================================================================
// Token & Cost Estimation
// ============================================================================

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

const GEMINI_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-2.0-flash-lite': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
};

export function estimateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING['gemini-2.0-flash'];
  return (inputTokens / 1_000_000) * pricing.inputPer1M + 
         (outputTokens / 1_000_000) * pricing.outputPer1M;
}

// ============================================================================
// AI Provider
// ============================================================================

export interface AIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
}

export interface GenerationOptions {
  maxRetries?: number;
  systemInstruction?: string;
  verbose?: boolean;
}

export class AIContentEngine {
  private client: GoogleGenAI;
  private model: string;
  private verbose: boolean;

  constructor(config: AIConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gemini-2.0-flash';
    this.verbose = config.temperature !== undefined;
  }

  async generate<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<{
    success: boolean;
    data?: T;
    error?: string;
    usage?: TokenUsage;
    attempts: number;
  }> {
    const maxRetries = options.maxRetries ?? 2;
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts++;

      try {
        // Convert Zod schema to Gemini schema format
        const geminiSchema = zodToGeminiSchema(schema);
        
        console.log('[AI] Requesting content with schema:', JSON.stringify(geminiSchema, null, 2));
        
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: geminiSchema,
            safetySettings,
            systemInstruction: options.systemInstruction ? { text: options.systemInstruction } : undefined,
          },
        });

        const text = response.text;
        if (!text) {
          return { success: false, error: 'Empty response from AI', attempts };
        }
        
        console.log('[AI] Raw response:', text.slice(0, 500));

        const parsed = JSON.parse(text);
        const validated = schema.parse(parsed);

        const inputTokens = Math.ceil(prompt.length / 4);
        const outputTokens = Math.ceil(text.length / 4);
        const estimatedCost = estimateTokenCost(this.model, inputTokens, outputTokens);

        return {
          success: true,
          data: validated,
          usage: { inputTokens, outputTokens, estimatedCost },
          attempts,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMsg = `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
          
          if (attempts <= maxRetries) {
            if (this.verbose) console.log(`⚠️  Attempt ${attempts} validation failed, retrying...`);
            continue;
          }
          
          return { success: false, error: errorMsg, attempts };
        }
        
        const errorMsg = String(error);
        if (attempts <= maxRetries) {
          if (this.verbose) console.log(`⚠️  Attempt ${attempts} failed, retrying...`);
          continue;
        }
        
        return { success: false, error: errorMsg, attempts };
      }
    }

    return { success: false, error: 'Max retries exceeded', attempts };
  }

  // Convenience methods for specific content types

  async generateHomepageContent(
    businessName: string,
    industry: string,
    options?: GenerationOptions
  ): Promise<{ success: boolean; data?: HomepageContent; error?: string }> {
    const prompt = `Generate complete homepage content for a ${industry} business.

Business: ${businessName}
Industry: ${industry}

Include a compelling hero section, about section with 2-3 paragraphs, 3-6 services/features, and optional testimonials.

Return valid JSON matching the schema.`;

    const systemInstruction = `You are a professional content writer for business websites. Generate compelling, professional copy appropriate for the specified industry. Always return valid JSON that matches the provided schema exactly.`;

    const result = await this.generate(HomepageContentSchema, prompt, {
      ...options,
      systemInstruction,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  async generateAboutContent(
    businessName: string,
    industry: string,
    options?: GenerationOptions
  ): Promise<{ success: boolean; data?: AboutPageContent; error?: string }> {
    const prompt = `Generate about page content for a ${industry} business.

Business: ${businessName}
Industry: ${industry}

Include a heading and subheading, 2-4 story paragraphs about the business history, a mission statement, 2-5 company values, and optional team members.

Return valid JSON matching the schema.`;

    const systemInstruction = `You are a professional content writer for business websites. Generate authentic, compelling about page copy. Always return valid JSON matching the schema.`;

    const result = await this.generate(AboutPageContentSchema, prompt, {
      ...options,
      systemInstruction,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  async generateServiceContent(
    businessName: string,
    industry: string,
    serviceName: string,
    options?: GenerationOptions
  ): Promise<{ success: boolean; data?: ServiceContent; error?: string }> {
    const prompt = `Generate service page content for a ${industry} business.

Business: ${businessName}
Industry: ${industry}
Service: ${serviceName}

Include a main heading, description, 2-8 service features with titles and descriptions, and optional pricing tiers.

Return valid JSON matching the schema.`;

    const systemInstruction = `You are a professional content writer for service pages. Be specific and detailed about services offered. Always return valid JSON matching the schema.`;

    const result = await this.generate(ServiceContentSchema, prompt, {
      ...options,
      systemInstruction,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  async generateSEOContent(
    businessName: string,
    industry: string,
    pageType: string,
    options?: GenerationOptions
  ): Promise<{ success: boolean; data?: SEOContent; error?: string }> {
    const prompt = `Generate SEO meta content for a ${pageType} page.

Business: ${businessName}
Industry: ${industry}
Page Type: ${pageType}

Generate an SEO title (under 60 chars), description (50-160 chars), 5-15 keywords, and optional OG image suggestion.

Return valid JSON matching the schema.`;

    const systemInstruction = `You are an SEO specialist. Generate optimized meta content for search engines. Always return valid JSON matching the schema.`;

    const result = await this.generate(SEOContentSchema, prompt, {
      ...options,
      systemInstruction,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }

  async generateImageAltText(
    imageDescription: string,
    context: string,
    options?: GenerationOptions
  ): Promise<{ success: boolean; data?: ImageAltText; error?: string }> {
    const prompt = `Generate an accessibility alt text description for an image.

Image Description: ${imageDescription}
Page Context: ${context}

Generate a descriptive alt text that conveys the image content for visually impaired users.

Return valid JSON matching the schema.`;

    const systemInstruction = `You are an accessibility specialist. Write descriptive alt text for images that conveys meaning to users who cannot see them. Be specific but concise. Always return valid JSON matching the schema.`;

    const result = await this.generate(ImageAltTextSchema, prompt, {
      ...options,
      systemInstruction,
    });

    return {
      success: result.success,
      data: result.data,
      error: result.error,
    };
  }
}

// ============================================================================
// Usage Logger
// ============================================================================

export interface UsageLogEntry {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs?: number;
  feature?: string;
}

export type UsageLogger = (entry: UsageLogEntry) => Promise<void>;

let globalLogger: UsageLogger | null = null;

export function setUsageLogger(logger: UsageLogger): void {
  globalLogger = logger;
}

export async function logUsage(entry: UsageLogEntry): Promise<void> {
  if (globalLogger) {
    await globalLogger(entry);
  }
}

// ============================================================================
// Factory
// ============================================================================

let globalEngine: AIContentEngine | null = null;

export function getContentEngine(): AIContentEngine {
  if (!globalEngine) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    globalEngine = new AIContentEngine({ apiKey });
  }
  return globalEngine;
}
