/**
 * Captures a screenshot of rendered HTML using a headless browser.
 * Used by the visual QA batch script - NOT part of the live preview path
 * (the live Preview tab uses the iframe render directly; this is only for
 * the once-per-template QA comparison against reference screenshots).
 */
import { chromium } from 'playwright';

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
}

export async function captureScreenshot(html: string, options: ScreenshotOptions = {}): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: options.width ?? 1200, height: options.height ?? 800 },
    });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    const buffer = await page.screenshot({ fullPage: options.fullPage ?? false });
    return buffer;
  } finally {
    await browser.close();
  }
}