/**
 * Captures screenshot of rendered HTML using headless browser.
 * Used by the visual QA batch script - NOT part of the live preview path.
 */
import { chromium, Browser, Page } from 'playwright';

export interface ScreenshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
}

let browser: Browser | null = null;
let page: Page | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch();
  }
  return browser;
}

async function getPage(browser: Browser, options: ScreenshotOptions): Promise<Page> {
  if (!page) {
    page = await browser.newPage();
  }
  await page.setViewportSize({ width: options.width ?? 1200, height: options.height ?? 800 });
  return page;
}

/**
 * Captures screenshot of HTML content.
 * Reuses browser instance for efficiency.
 */
export async function captureScreenshot(html: string, options: ScreenshotOptions = {}): Promise<Buffer> {
  const b = await getBrowser();
  const p = await getPage(b, options);
  
  await p.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  const buffer = await p.screenshot({ fullPage: options.fullPage ?? false });
  
  return buffer;
}

/**
 * Cleanup function - call when done with all screenshots.
 */
export async function closeBrowser(): Promise<void> {
  if (page) {
    await page.close();
    page = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}
