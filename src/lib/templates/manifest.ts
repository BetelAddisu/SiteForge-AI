/**
 * Shared template-kit helpers.
 *
 * Single source of truth for the ZIP/manifest parsing logic that was
 * previously copy-pasted (with drift) across the template API routes:
 * slugify, extractKitSlug, detectCategory, detectIndustry, the Manifest
 * interfaces, and the cached ZIP-from-R2 loader.
 *
 * Usage:
 *   import { extractKitSlug, detectCategory, getZipFromR2 } from '@/lib/templates/manifest';
 */

import JSZip from 'jszip';
import { getStorageProvider } from '@/lib/storage';

// ============================================================================
// Manifest types
// ============================================================================

export interface ManifestTemplate {
  name: string;
  screenshot: string;
  source: string;
  type: string;
  metadata?: Record<string, unknown>;
  elementor_pro_required: boolean;
}

export interface Manifest {
  manifest_version: string;
  title: string;
  page_builder?: string;
  templates: ManifestTemplate[];
}

// ============================================================================
// Name helpers
// ============================================================================

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

export function extractKitSlug(filename: string): string {
  const withoutExt = filename.replace('.zip', '');
  const withoutTimestamp = withoutExt.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-utc$/, '');
  const cleanName = withoutTimestamp
    .replace(/-elementor-template-kit$/i, '')
    .replace(/-elementor-pro-template-kit$/i, '')
    .replace(/-woocommerce-el$/i, '')
    .replace(/-wordpress-theme$/i, '')
    .replace(/-full$/i, '');
  return cleanName;
}

// ============================================================================
// Classification
// ============================================================================

export function detectCategory(templateName: string): string {
  const name = templateName.toLowerCase();
  if (name.includes('hero') || name.includes('home') || name.includes('banner')) return 'hero';
  if (name.includes('about') || name.includes('who')) return 'about';
  if (name.includes('service')) return 'services';
  if (name.includes('pricing') || name.includes('price')) return 'pricing';
  if (name.includes('team')) return 'team';
  if (name.includes('testimonial') || name.includes('review')) return 'testimonial';
  if (name.includes('faq')) return 'faq';
  if (name.includes('contact')) return 'contact';
  if (name.includes('header')) return 'header';
  if (name.includes('footer')) return 'footer';
  if (name.includes('product')) return 'product';
  if (name.includes('off-canvas') || name.includes('offcanvas')) return 'offcanvas';
  if (name.includes('form')) return 'form';
  if (name.includes('blog') || name.includes('post')) return 'blog';
  if (name.includes('404')) return 'error';
  return 'section';
}

export function detectIndustry(kitName: string): string | null {
  const name = kitName.toLowerCase();
  const industries: [string, string][] = [
    ['wine', 'Restaurant'], ['restaurant', 'Restaurant'], ['cafe', 'Restaurant'], ['food', 'Restaurant'],
    ['digital', 'Technology'], ['tech', 'Technology'], ['ai', 'Technology'], ['robotics', 'Technology'],
    ['marketing', 'Marketing'], ['agency', 'Marketing'],
    ['medical', 'Healthcare'], ['health', 'Healthcare'],
    ['fitness', 'Fitness'], ['gym', 'Fitness'],
    ['real estate', 'Real Estate'], ['property', 'Real Estate'],
    ['legal', 'Legal'], ['law', 'Legal'],
    ['finance', 'Finance'], ['financial', 'Finance'],
    ['travel', 'Travel'], ['hotel', 'Travel'],
    ['education', 'Education'],
    ['nonprofit', 'Non-Profit'], ['charity', 'Non-Profit'],
    ['ecommerce', 'E-commerce'], ['shop', 'E-commerce'],
    ['creative', 'Creative'], ['portfolio', 'Creative'],
    ['architecture', 'Architecture'], ['interior', 'Architecture'],
    ['fashion', 'Fashion'], ['beauty', 'Fashion'],
  ];
  for (const [key, value] of industries) {
    if (name.includes(key)) return value;
  }
  return null;
}

// ============================================================================
// ZIP loading (cached)
// ============================================================================

const zipCache = new Map<string, { zip: JSZip; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export async function getZipFromR2(zipName: string): Promise<JSZip | null> {
  const cached = zipCache.get(zipName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.zip;
  }

  try {
    const provider = await getStorageProvider();
    const zipData = await provider.downloadFile(zipName);

    if (!zipData) return null;

    const zip = await JSZip.loadAsync(zipData);
    zipCache.set(zipName, { zip, timestamp: Date.now() });

    return zip;
  } catch (err) {
    console.error('[Manifest] Error fetching ZIP from storage:', err);
    return null;
  }
}
