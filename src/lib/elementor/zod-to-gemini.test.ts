import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Type } from '@google/genai';
import { zodToGeminiSchema } from './zod-to-gemini';

/**
 * This converter exists because of a real production bug: generate() used
 * to pass a raw Zod schema instance directly as Gemini's `responseSchema`
 * (only type-cast, never actually converted). Gemini needs its own plain
 * object format using the SDK's Type enum - a Zod schema is a class
 * instance with internal methods, not remotely compatible. Every AI
 * content-generation call was failing silently as a result. These tests
 * lock in that every schema shape actually used by this codebase
 * (HomepageContentSchema, AboutPageContentSchema, etc.) converts to a
 * structurally valid Gemini schema.
 */

describe('zodToGeminiSchema', () => {
  it('converts a plain string schema', () => {
    expect(zodToGeminiSchema(z.string())).toEqual({ type: Type.STRING });
  });

  it('converts a plain number schema', () => {
    expect(zodToGeminiSchema(z.number())).toEqual({ type: Type.NUMBER });
  });

  it('converts a plain boolean schema', () => {
    expect(zodToGeminiSchema(z.boolean())).toEqual({ type: Type.BOOLEAN });
  });

  it('converts an object schema with correct properties and required fields', () => {
    const schema = z.object({
      heading: z.string(),
      subheading: z.string().optional(),
    });
    const result = zodToGeminiSchema(schema);

    expect(result.type).toBe(Type.OBJECT);
    expect(result.properties).toEqual({
      heading: { type: Type.STRING },
      subheading: { type: Type.STRING },
    });
    // Optional fields must NOT appear in `required`, or Gemini will reject
    // valid responses that omit them.
    expect(result.required).toEqual(['heading']);
  });

  it('marks every field required when none are optional', () => {
    const schema = z.object({ a: z.string(), b: z.string() });
    const result = zodToGeminiSchema(schema);
    expect(result.required).toEqual(['a', 'b']);
  });

  it('omits `required` entirely when every field is optional', () => {
    const schema = z.object({ a: z.string().optional() });
    const result = zodToGeminiSchema(schema);
    expect(result.required).toBeUndefined();
  });

  it('converts an array schema with its item type', () => {
    const schema = z.array(z.object({ title: z.string() }));
    const result = zodToGeminiSchema(schema);
    expect(result.type).toBe(Type.ARRAY);
    expect((result.items as { type: string }).type).toBe(Type.OBJECT);
  });

  it('unwraps optional and default modifiers to the underlying type', () => {
    expect(zodToGeminiSchema(z.string().optional())).toEqual({ type: Type.STRING });
    expect(zodToGeminiSchema(z.string().default('x'))).toEqual({ type: Type.STRING });
  });

  it('carries over .describe() descriptions', () => {
    const schema = z.string().describe('The page heading');
    const result = zodToGeminiSchema(schema);
    expect(result.description).toBe('The page heading');
  });

  it('converts a realistic nested content schema (matches HomepageContentSchema shape)', () => {
    const schema = z.object({
      hero: z.object({
        heading: z.string(),
        subheading: z.string(),
        ctaText: z.string(),
      }),
      services: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
        })
      ),
    });

    const result = zodToGeminiSchema(schema);
    expect(result.type).toBe(Type.OBJECT);
    expect(result.required).toEqual(expect.arrayContaining(['hero', 'services']));

    const properties = result.properties as Record<string, { type: string }>;
    expect(properties.hero.type).toBe(Type.OBJECT);
    expect(properties.services.type).toBe(Type.ARRAY);
  });
});
