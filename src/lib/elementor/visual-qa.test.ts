import { describe, it, expect } from 'vitest';
import { aggregateReports, VisualQaReportSchema, type VisualQaReport } from './visual-qa';
import { zodToGeminiSchema } from './zod-to-gemini';

function makeReport(overrides: Partial<VisualQaReport> = {}): VisualQaReport {
  return {
    similarityScore: 80,
    hasBackgroundIssue: false,
    hasContrastIssue: false,
    hasMissingImages: false,
    hasMissingIcons: false,
    layoutIssues: [],
    missingWidgetTypes: [],
    notes: '',
    ...overrides,
  };
}

describe('aggregateReports', () => {
  it('returns zeroed-out summary for an empty report list', () => {
    const summary = aggregateReports([]);
    expect(summary.totalTemplates).toBe(0);
    expect(summary.averageSimilarityScore).toBe(0);
    expect(summary.commonLayoutIssues).toEqual([]);
  });

  it('counts each issue type independently across the batch', () => {
    const reports = [
      makeReport({ hasBackgroundIssue: true }),
      makeReport({ hasContrastIssue: true }),
      makeReport({ hasBackgroundIssue: true, hasMissingIcons: true }),
      makeReport(),
    ];
    const summary = aggregateReports(reports);
    expect(summary.totalTemplates).toBe(4);
    expect(summary.backgroundIssueCount).toBe(2);
    expect(summary.contrastIssueCount).toBe(1);
    expect(summary.missingIconsCount).toBe(1);
    expect(summary.missingImagesCount).toBe(0);
  });

  it('computes the average similarity score correctly', () => {
    const reports = [
      makeReport({ similarityScore: 100 }),
      makeReport({ similarityScore: 50 }),
      makeReport({ similarityScore: 0 }),
    ];
    expect(aggregateReports(reports).averageSimilarityScore).toBe(50);
  });

  it('ranks layout issues by frequency, most common first - this is the actual point of the tool: prioritizing which shared bug to fix next', () => {
    const reports = [
      makeReport({ layoutIssues: ['dark background text unreadable'] }),
      makeReport({ layoutIssues: ['dark background text unreadable'] }),
      makeReport({ layoutIssues: ['dark background text unreadable', 'missing hero image'] }),
      makeReport({ layoutIssues: ['wrong column width'] }),
    ];
    const summary = aggregateReports(reports);
    expect(summary.commonLayoutIssues[0]).toEqual({ issue: 'dark background text unreadable', count: 3 });
    expect(summary.commonLayoutIssues.some(i => i.issue === 'missing hero image' && i.count === 1)).toBe(true);
    expect(summary.commonLayoutIssues.some(i => i.issue === 'wrong column width' && i.count === 1)).toBe(true);
  });

  it('ranks missing widget types by frequency the same way', () => {
    const reports = [
      makeReport({ missingWidgetTypes: ['icon-list'] }),
      makeReport({ missingWidgetTypes: ['icon-list', 'google_maps'] }),
    ];
    const summary = aggregateReports(reports);
    expect(summary.commonMissingWidgetTypes[0]).toEqual({ widgetType: 'icon-list', count: 2 });
  });
});

describe('VisualQaReportSchema', () => {
  it('accepts a well-formed report', () => {
    const result = VisualQaReportSchema.safeParse(makeReport());
    expect(result.success).toBe(true);
  });

  it('rejects a similarity score outside 0-100', () => {
    const result = VisualQaReportSchema.safeParse(makeReport({ similarityScore: 150 }));
    expect(result.success).toBe(false);
  });

  it('converts cleanly to a valid Gemini schema (same conversion path that broke AI generation earlier in this project)', () => {
    const geminiSchema = zodToGeminiSchema(VisualQaReportSchema);
    expect(geminiSchema.type).toBeDefined();
    const properties = geminiSchema.properties as Record<string, unknown>;
    expect(properties.similarityScore).toBeDefined();
    expect(properties.hasBackgroundIssue).toBeDefined();
    expect(properties.layoutIssues).toBeDefined();
  });
});