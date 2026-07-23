/**
 * Converts a Zod schema into the Schema format Gemini's `responseSchema`
 * config actually expects (an OpenAPI-3.0-subset object using the SDK's
 * `Type` enum: { type: Type.OBJECT, properties: {...}, required: [...] }).
 *
 * Previously, generate() in schemas.ts passed the raw Zod schema instance
 * directly as `responseSchema` (only type-cast, never actually converted).
 * A Zod schema is a JS class instance with internal methods like .parse()
 * and ._def - it doesn't remotely resemble the plain object Gemini expects,
 * so every generateContent() call with a responseSchema was most likely
 * rejected by the API or silently ignored, causing every content-generation
 * call to fail and fall back to empty data - which is why generated sites
 * were showing hardcoded placeholder text ("Welcome to Our Website", etc.)
 * instead of real AI output.
 */
import { Type } from '@google/genai';
import { z } from 'zod';

export function zodToGeminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap modifiers that don't change the underlying shape for Gemini's
  // purposes - optionality is handled by the caller via `required`.
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return zodToGeminiSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodDefault) {
    return zodToGeminiSchema(schema._def.innerType);
  }

  const description = (schema as z.ZodTypeAny).description;

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToGeminiSchema(value);
      const isOptional =
        value instanceof z.ZodOptional ||
        value instanceof z.ZodDefault ||
        value.isOptional?.();
      if (!isOptional) {
        required.push(key);
      }
    }

    return {
      type: Type.OBJECT,
      properties,
      ...(required.length > 0 ? { required } : {}),
      ...(description ? { description } : {}),
    };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: Type.ARRAY,
      items: zodToGeminiSchema(schema.element),
      ...(description ? { description } : {}),
    };
  }

  if (schema instanceof z.ZodString) {
    return { type: Type.STRING, ...(description ? { description } : {}) };
  }

  if (schema instanceof z.ZodNumber) {
    return { type: Type.NUMBER, ...(description ? { description } : {}) };
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: Type.BOOLEAN, ...(description ? { description } : {}) };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: Type.STRING,
      enum: schema.options,
      ...(description ? { description } : {}),
    };
  }

  // Fallback - treat anything unrecognized as a free-form string rather
  // than silently producing an invalid/empty schema node.
  return { type: Type.STRING, ...(description ? { description } : {}) };
}
