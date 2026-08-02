import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { AIContentEngine } from './schemas';

/**
 * These tests verify that AI generation failures are surfaced as errors
 * (Rule #1: "Never catch a failure and continue with empty or placeholder data").
 *
 * The pipeline throws when generateHomepageContent returns success: false,
 * so this test mocks the underlying GoogleGenAI client to confirm that
 * the engine itself returns a clear failure status rather than empty data.
 */

// Mock the underlying AI client before importing schemas
vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn();
  const mockModels = { generateContent: mockGenerateContent };

  const GoogleGenAI = vi.fn().mockImplementation(() => ({
    models: mockModels,
  }));

  return {
    GoogleGenAI,
    HarmCategory: { HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT' },
    HarmBlockThreshold: { BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE' },
    // zod-to-gemini.ts also imports Type from this module to build the
    // Gemini responseSchema - since the whole module is mocked here, that
    // import needs a real value too, or it resolves to undefined and
    // schemas.ts throws before ever reaching the code path under test.
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
    },
  };
});

describe('AI failure-path handling', () => {
  let engine: AIContentEngine;
  let mockGenAI: { models: { generateContent: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AIContentEngine({ apiKey: 'test-key' });

    // Using a static top-level import + vi.mocked() ensures we reference the
    // SAME mocked module instance that schemas.ts's `import { GoogleGenAI }`
    // resolved to. A mid-test require('@google/genai') can resolve to a
    // different module registration under Vitest's ESM/CJS interop, leaving
    // `.mock.results` empty even though the mock factory above ran correctly.
    const mocked = vi.mocked(GoogleGenAI);
    const instance = mocked.mock.results[0]?.value;
    mockGenAI = instance || { models: { generateContent: vi.fn() } };
  });

  it('returns success: false when the AI response is empty', async () => {
    // Simulate Gemini returning empty text
    mockGenAI.models.generateContent.mockResolvedValue({ text: null });

    const result = await engine.generateHomepageContent('Test Business', 'Technology');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Empty response');
  });

  it('returns success: false when the AI API call throws', async () => {
    // Simulate a network/API error
    mockGenAI.models.generateContent.mockRejectedValue(new Error('API rate limit exceeded'));

    const result = await engine.generateHomepageContent('Test Business', 'Technology');

    expect(result.success).toBe(false);
    expect(result.error).toContain('API rate limit');
  });

  it('returns success: false when AI returns invalid JSON', async () => {
    // Simulate bad JSON from the AI
    mockGenAI.models.generateContent.mockResolvedValue({ text: 'not valid json at all' });

    const result = await engine.generateHomepageContent('Test Business', 'Technology');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns success: false when AI returns JSON that fails Zod validation', async () => {
    // Simulate valid JSON that doesn't match schema (missing required hero.heading)
    mockGenAI.models.generateContent.mockResolvedValue({
      text: JSON.stringify({
        hero: { subheading: 'Missing heading field' },
        about: { heading: 'About', paragraphs: ['para'] },
        services: [{ title: 'Svc', description: 'desc' }],
      }),
    });

    const result = await engine.generateHomepageContent('Test Business', 'Technology');

    expect(result.success).toBe(false);
    // Should mention the missing field
    expect(result.error).toContain('hero');
  });
});
