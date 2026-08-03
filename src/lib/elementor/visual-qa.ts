/**
 * Visual QA: compares renderer output against reference screenshots.
 *
 * Run once per template (not per generation) via scripts/qa/visual-qa-batch.ts.
 * Nearly every rendering bug found in this project was a shared-renderer bug,
 * not a template-specific one - fixing it once fixes it everywhere.
 */
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { zodToGeminiSchema } from './zod-to-gemini';

export const VisualQaReportSchema = z.object({
  similarityScore: z.number().min(0).max(100).describe('Overall visual similarity 0-100'),
  hasBackgroundIssue: z.boolean().describe('True if backgrounds (color/gradient/image) are missing or wrong'),
  hasContrastIssue: z.boolean().describe('True if text is hard to read against its background'),
  hasMissingImages: z.boolean().describe('True if images visible in reference are missing in render'),
  hasMissingIcons: z.boolean().describe('True if icon glyphs are missing/blank in render'),
  layoutIssues: z.array(z.string()).describe('Specific layout differences'),
  missingWidgetTypes: z.array(z.string()).describe('Widget types that appear unrendered'),
  notes: z.string().describe('Other specific visual discrepancies'),
});

export type VisualQaReport = z.infer<typeof VisualQaReportSchema>;

interface CompareOptions {
  apiKey: string;
  model?: string;
  templateName?: string;
}

/**
 * Compares reference screenshot against rendered output using Gemini vision.
 */
export async function compareScreenshots(
  referenceImageBase64: string,
  renderedImageBase64: string,
  options: CompareOptions
): Promise<{ success: boolean; data?: VisualQaReport; error?: string }> {
  const client = new GoogleGenAI({ apiKey: options.apiKey });
  const model = options.model || 'gemini-2.5-flash-lite';

  const prompt = `You are comparing two screenshots of the same website template.

Image 1 is the REFERENCE - the template's real, correct appearance.
Image 2 is our RENDERED output - an attempt to reproduce it.

Identify concrete visual discrepancies:
- Missing or wrong backgrounds (solid colors, gradients, images)
- Text hard to read against background (contrast issues)
- Missing images that are visible in reference
- Missing icon glyphs (blank space where icon should be)
- Layout differences (wrong column widths, spacing, positions)

Do not comment on minor font rendering, exact pixel positioning, or hover states.`;

  try {
    const geminiSchema = zodToGeminiSchema(VisualQaReportSchema);

    const response = await client.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { text: 'Image 1 (REFERENCE):' },
          { inlineData: { mimeType: 'image/png', data: referenceImageBase64 } },
          { text: 'Image 2 (RENDERED):' },
          { inlineData: { mimeType: 'image/png', data: renderedImageBase64 } },
        ],
      }],
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
 * Aggregates batch of reports into frequency counts for prioritization.
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
