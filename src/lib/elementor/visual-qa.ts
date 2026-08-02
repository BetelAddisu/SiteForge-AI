/**
 * Visual QA: compares our renderer's output against a template's real
 * reference screenshot, once per template (not per generation).
 *
 * Why once per template, not per generation: nearly every rendering bug
 * found in this project so far (missing container backgrounds, unresolved
 * __globals__ colors, missing icon fonts) was a shared-renderer bug, not a
 * template-specific one - fixing it in one place fixes it everywhere. A
 * per-generation vision check would also repeat the same
 * expensive-operation-on-every-request pattern that caused the Supabase
 * egress restriction earlier in this project. This runs in batch, against
 * each template's own original content, and produces a report used to
 * prioritize which shared renderer bug to fix next - not a per-template
 * patch.
 */
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { zodToGeminiSchema } from './zod-to-gemini';

export const VisualQaReportSchema = z.object({
  similarityScore: z.number().min(0).max(100).describe('Overall visual similarity, 0-100'),
  hasBackgroundIssue: z.boolean().describe('True if backgrounds (color/gradient/image) are missing or wrong'),
  hasContrastIssue: z.boolean().describe('True if text is hard to read against its background (e.g. dark text on dark background)'),
  hasMissingImages: z.boolean().describe('True if images visible in the reference are missing in the rendered version'),
  hasMissingIcons: z.boolean().describe('True if icon glyphs visible in the reference are missing/blank in the rendered version'),
  layoutIssues: z.array(z.string()).describe('Specific layout differences: wrong column widths, wrong spacing, elements in the wrong position, etc.'),
  missingWidgetTypes: z.array(z.string()).describe("Best-guess widget types that appear unrendered or placeholder-like, if identifiable"),
  notes: z.string().describe('Any other specific, concrete visual discrepancy worth noting'),
});

export type VisualQaReport = z.infer<typeof VisualQaReportSchema>;

interface CompareOptions {
  apiKey: string;
  model?: string;
  templateName?: string;
}

/**
 * Compares a reference screenshot (the template's real, known-correct
 * appearance) against our rendered output, returning a structured report
 * of concrete discrepancies - not a generic "looks different" verdict.
 */
export async function compareScreenshots(
  referenceImageBase64: string,
  renderedImageBase64: string,
  options: CompareOptions
): Promise<{ success: boolean; data?: VisualQaReport; error?: string }> {
  const client = new GoogleGenAI({ apiKey: options.apiKey });
  const model = options.model || 'gemini-2.0-flash';

  const prompt = `You are comparing two screenshots of the same website template${options.templateName ? ` ("${options.templateName}")` : ''}.

Image 1 is the REFERENCE screenshot - the template's real, correct appearance.
Image 2 is our RENDERED output - an attempt to reproduce it from the same underlying page-builder data.

Identify concrete, specific visual discrepancies between them. Focus on:
- Missing or wrong backgrounds (solid colors, gradients, images)
- Text that is hard to read against its background (contrast issues)
- Missing images that are visible in the reference
- Missing icon glyphs (blank space where an icon should be)
- Layout differences (wrong column widths, spacing, element positions)

Do not comment on minor font rendering differences, exact pixel positioning, or animation/hover states - focus on differences a website visitor would immediately notice.`;

  try {
    const geminiSchema = zodToGeminiSchema(VisualQaReportSchema);

    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { text: 'Image 1 (REFERENCE):' },
            { inlineData: { mimeType: 'image/png', data: referenceImageBase64 } },
            { text: 'Image 2 (RENDERED):' },
            { inlineData: { mimeType: 'image/png', data: renderedImageBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return { success: false, error: 'Empty response from AI' };
    }

    const parsed = JSON.parse(text);
    const validated = VisualQaReportSchema.parse(parsed);

    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` };
    }
    return { success: false, error: String(error) };
  }
}

/**
 * Aggregates a batch of reports into frequency counts, so the output of a
 * full-library QA run is a prioritized list of shared renderer bugs to
 * fix - "which issue affects the most templates" - rather than a wall of
 * individual per-template findings nobody will read end to end.
 */
export interface QaAggregateSummary {
  totalTemplates: number;
  backgroundIssueCount: number;
  contrastIssueCount: number;
  missingImagesCount: number;
  missingIconsCount: number;
  averageSimilarityScore: number;
  commonLayoutIssues: Array<{ issue: string; count: number }>;
  commonMissingWidgetTypes: Array<{ widgetType: string; count: number }>;
}

export function aggregateReports(reports: VisualQaReport[]): QaAggregateSummary {
  const total = reports.length;
  if (total === 0) {
    return {
      totalTemplates: 0,
      backgroundIssueCount: 0,
      contrastIssueCount: 0,
      missingImagesCount: 0,
      missingIconsCount: 0,
      averageSimilarityScore: 0,
      commonLayoutIssues: [],
      commonMissingWidgetTypes: [],
    };
  }

  const layoutIssueCounts = new Map<string, number>();
  const widgetTypeCounts = new Map<string, number>();

  for (const r of reports) {
    for (const issue of r.layoutIssues) {
      layoutIssueCounts.set(issue, (layoutIssueCounts.get(issue) || 0) + 1);
    }
    for (const wt of r.missingWidgetTypes) {
      widgetTypeCounts.set(wt, (widgetTypeCounts.get(wt) || 0) + 1);
    }
  }

  const sortByCount = <T extends string>(map: Map<T, number>) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

  return {
    totalTemplates: total,
    backgroundIssueCount: reports.filter(r => r.hasBackgroundIssue).length,
    contrastIssueCount: reports.filter(r => r.hasContrastIssue).length,
    missingImagesCount: reports.filter(r => r.hasMissingImages).length,
    missingIconsCount: reports.filter(r => r.hasMissingIcons).length,
    averageSimilarityScore: Math.round(reports.reduce((sum, r) => sum + r.similarityScore, 0) / total),
    commonLayoutIssues: sortByCount(layoutIssueCounts).map(({ key, count }) => ({ issue: key, count })),
    commonMissingWidgetTypes: sortByCount(widgetTypeCounts).map(({ key, count }) => ({ widgetType: key, count })),
  };
}