#!/usr/bin/env tsx
/**
 * test-ai-replacement.ts
 * 
 * Phase 0: AI Content Replacement Tester
 * Tests AI-powered content generation with Zod schema validation.
 * 
 * Usage: npx tsx test-ai-replacement.ts [options]
 * 
 * Options:
 *   --template <path>     Path to Elementor template JSON
 *   --business <name>      Business name for content generation
 *   --industry <name>     Industry for context
 *   --count <number>      Number of test generations (default: 3)
 *   --verbose             Show detailed output
 */

import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';

// ============================================================================
// Zod Schemas for AI Output Validation
// ============================================================================

const ContentReplacementSchema = z.object({
  heading: z.string().min(1).max(200).describe('Replacement heading text'),
  subheading: z.string().optional().max(300).describe('Optional subheading'),
  paragraphs: z.array(z.string().min(10).max(1000)).min(1).max(5).describe('Paragraph content'),
  callToAction: z.object({
    text: z.string().min(1).max(50).describe('Button or CTA text'),
    url: z.string().url().optional().describe('Link destination'),
  }).optional(),
  suggestedColors: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).min(1).max(5).optional().describe('Suggested color values'),
});

const HomepageContentSchema = z.object({
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

const AboutPageContentSchema = z.object({
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

const ServiceContentSchema = z.object({
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

type ContentReplacement = z.infer<typeof ContentReplacementSchema>;
type HomepageContent = z.infer<typeof HomepageContentSchema>;
type AboutPageContent = z.infer<typeof AboutPageContentSchema>;
type ServiceContent = z.infer<typeof ServiceContentSchema>;

// ============================================================================
// Token & Cost Estimation
// ============================================================================

const GEMINI_PRICING = {
  'gemini-2.0-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-2.0-flash-lite': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
  'gemini-1.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
};

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

// ============================================================================
// AI Client
// ============================================================================

class AIReplacer {
  private client: GoogleGenAI;
  private model: string;
  private verbose: boolean;
  
  constructor(apiKey: string, model: string = 'gemini-2.0-flash', verbose: boolean = false) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
    this.verbose = verbose;
  }
  
  async generateContent<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    systemInstruction?: string
  ): Promise<{ success: boolean; data?: T; error?: string; usage?: TokenUsage }> {
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
    
    try {
      if (this.verbose) {
        console.log('📤 Sending request to Gemini...');
        console.log(`   Model: ${this.model}`);
        console.log(`   Prompt length: ${prompt.length} chars`);
      }
      
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          safetySettings,
          systemInstruction: systemInstruction ? { text: systemInstruction } : undefined,
        },
      });
      
      const text = response.text;
      if (!text) {
        return { success: false, error: 'Empty response from AI' };
      }
      
      // Parse and validate
      const parsed = JSON.parse(text);
      const validated = schema.parse(parsed);
      
      // Estimate tokens (rough approximation)
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(text.length / 4);
      const pricing = GEMINI_PRICING[this.model as keyof typeof GEMINI_PRICING] || GEMINI_PRICING['gemini-2.0-flash'];
      const estimatedCost = (inputTokens / 1_000_000) * pricing.inputPer1M + 
                           (outputTokens / 1_000_000) * pricing.outputPer1M;
      
      return {
        success: true,
        data: validated,
        usage: { inputTokens, outputTokens, estimatedCost }
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
        };
      }
      return { success: false, error: String(error) };
    }
  }
  
  async generateWithRetry<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    maxRetries: number = 2,
    systemInstruction?: string
  ): Promise<{ success: boolean; data?: T; error?: string; usage?: TokenUsage; attempts: number }> {
    let attempts = 0;
    let lastError: string | undefined;
    
    while (attempts < maxRetries + 1) {
      attempts++;
      const result = await this.generateContent(schema, prompt, systemInstruction);
      
      if (result.success) {
        return { ...result, attempts };
      }
      
      lastError = result.error;
      
      if (this.verbose) {
        console.log(`⚠️  Attempt ${attempts} failed: ${lastError}`);
        if (attempts <= maxRetries) {
          console.log('   Retrying...');
        }
      }
    }
    
    return { success: false, error: lastError, attempts };
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

interface TestScenario {
  name: string;
  schema: z.ZodSchema<unknown>;
  generatePrompt: (businessName: string, industry: string) => string;
}

const SCENARIOS: TestScenario[] = [
  {
    name: 'Content Replacement (Heading + Paragraphs)',
    schema: ContentReplacementSchema,
    generatePrompt: (business, industry) => `
Generate replacement content for a ${industry} business website.

Business: ${business}
Industry: ${industry}

Generate a compelling heading, optional subheading, 2-3 paragraphs of website copy, 
and optionally a call-to-action. Make the content professional and appropriate for 
a ${industry} business.

Return valid JSON matching the schema.`,
  },
  {
    name: 'Homepage Content',
    schema: HomepageContentSchema,
    generatePrompt: (business, industry) => `
Generate complete homepage content for a ${industry} business.

Business: ${business}
Industry: ${industry}

Include:
- Hero section with heading and optional subheading
- About section with heading and paragraphs
- 3-6 services/features
- Optional testimonials

Return valid JSON matching the schema.`,
  },
  {
    name: 'About Page Content',
    schema: AboutPageContentSchema,
    generatePrompt: (business, industry) => `
Generate an about page for a ${industry} business.

Business: ${business}
Industry: ${industry}

Include:
- Heading and optional subheading
- 2-4 story paragraphs about the business history
- A mission statement
- 2-5 company values
- Optional team members (up to 6)

Return valid JSON matching the schema.`,
  },
  {
    name: 'Service Page Content',
    schema: ServiceContentSchema,
    generatePrompt: (business, industry) => `
Generate a services page for a ${industry} business.

Business: ${business}
Industry: ${industry}

Include:
- Main heading and description
- 2-8 service features with titles and descriptions
- Optional pricing tiers

Return valid JSON matching the schema.`,
  },
];

const SYSTEM_INSTRUCTION = `You are a professional content writer for business websites. 
Generate compelling, professional copy that is appropriate for the specified industry.
Always return valid JSON that matches the provided schema exactly.
Do not include any text outside the JSON response.`;

// ============================================================================
// Main
// ============================================================================

interface ParsedArgs {
  template?: string;
  business?: string;
  industry?: string;
  count: number;
  verbose: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = { count: 3, verbose: false };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--template':
        result.template = args[++i];
        break;
      case '--business':
        result.business = args[++i];
        break;
      case '--industry':
        result.industry = args[++i];
        break;
      case '--count':
        result.count = parseInt(args[++i], 10);
        break;
      case '--verbose':
        result.verbose = true;
        break;
    }
  }
  
  return result;
}

async function main() {
  const args = parseArgs();
  
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    console.log('');
    console.log('Set it with:');
    console.log('  export GEMINI_API_KEY=your_api_key');
    console.log('  npx tsx test-ai-replacement.ts');
    process.exit(1);
  }
  
  // Use defaults if not provided
  const businessName = args.business || 'Acme Industries';
  const industry = args.industry || 'Technology';
  
  console.log('═'.repeat(80));
  console.log('🤖 SiteForge AI - Phase 0 AI Replacement Test');
  console.log('═'.repeat(80));
  console.log(`   Business: ${businessName}`);
  console.log(`   Industry: ${industry}`);
  console.log(`   Test Count: ${args.count}`);
  console.log(`   Model: gemini-2.0-flash`);
  console.log('');
  
  const ai = new AIReplacer(apiKey, 'gemini-2.0-flash', args.verbose);
  
  const results: { scenario: string; success: boolean; attempts: number; usage?: TokenUsage; error?: string }[] = [];
  let totalCost = 0;
  
  for (let i = 0; i < args.count; i++) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📋 Test ${i + 1}/${args.count}`);
    console.log('─'.repeat(80));
    
    for (const scenario of SCENARIOS) {
      console.log(`\n   🔄 ${scenario.name}...`);
      
      const prompt = scenario.generatePrompt(businessName, industry);
      const result = await ai.generateWithRetry(scenario.schema, prompt, 1, SYSTEM_INSTRUCTION);
      
      if (result.success && result.data) {
        console.log(`      ✅ Success (${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`);
        if (result.usage) {
          console.log(`      📊 Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
          console.log(`      💰 Est. Cost: $${result.usage.estimatedCost.toFixed(6)}`);
          totalCost += result.usage.estimatedCost;
        }
        
        if (args.verbose) {
          console.log(`      📝 Output preview: ${JSON.stringify(result.data).substring(0, 200)}...`);
        }
        
        results.push({ scenario: scenario.name, success: true, attempts: result.attempts, usage: result.usage });
      } else {
        console.log(`      ❌ Failed: ${result.error}`);
        results.push({ scenario: scenario.name, success: false, attempts: result.attempts || 1, error: result.error });
      }
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📈 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  const successRate = ((successful / total) * 100).toFixed(1);
  
  console.log(`   Total Tests: ${total}`);
  console.log(`   Successful: ${successful} (${successRate}%)`);
  console.log(`   Failed: ${total - successful}`);
  console.log(`   Total Estimated Cost: $${totalCost.toFixed(6)}`);
  
  console.log('\n   By Scenario:');
  for (const scenario of SCENARIOS) {
    const scenarioResults = results.filter(r => r.scenario === scenario.name);
    const scenarioSuccess = scenarioResults.filter(r => r.success).length;
    const scenarioCost = scenarioResults.reduce((sum, r) => sum + (r.usage?.estimatedCost || 0), 0);
    console.log(`      • ${scenario.name}: ${scenarioSuccess}/${scenarioResults.length} ($${scenarioCost.toFixed(6)})`);
  }
  
  // Exit code based on success rate
  if (successful < total) {
    console.log('\n⚠️  Some tests failed. Review the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(console.error);
