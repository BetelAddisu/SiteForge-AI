/**
 * Business Info Miner
 * 
 * Phase 11: Extract business information from public sources.
 * 
 * Priority order:
 * 1. Official APIs (if connected)
 * 2. oEmbed endpoints (Instagram, TikTok, YouTube)
 * 3. Public-page fetch (websites, social profiles)
 * 
 * Constraint: No login simulation, no authentication bypass
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface BusinessInfo {
  name?: string;
  description?: string;
  logo?: string;
  coverImage?: string;
  services?: string[];
  products?: string[];
  testimonials?: Array<{
    quote: string;
    author?: string;
    rating?: number;
  }>;
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    website?: string;
  };
  social?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  hours?: Record<string, string>;
  pricing?: string;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface MiningResult {
  success: boolean;
  data?: BusinessInfo;
  source?: string;
  confidence: number;
  error?: string;
}

// ============================================================================
// Schema for AI Extraction
// ============================================================================

const BusinessInfoSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  logo: z.string().url().optional(),
  coverImage: z.string().url().optional(),
  services: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  testimonials: z.array(z.object({
    quote: z.string(),
    author: z.string().optional(),
    rating: z.number().optional(),
  })).optional(),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    website: z.string().optional(),
  }).optional(),
  social: z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
  }).optional(),
  hours: z.record(z.string()).optional(),
  pricing: z.string().optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
});

// ============================================================================
// OEmbed Extraction
// ============================================================================

/**
 * Extract info from Instagram oEmbed
 */
export async function getInstagramOembed(postUrl: string): Promise<{
  success: boolean;
  data?: { html: string; thumbnail_url?: string; author_name?: string };
  error?: string;
}> {
  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&maxwidth=480`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { success: false, error: `Instagram oEmbed error: ${response.status}` };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: {
        html: data.html || '',
        thumbnail_url: data.thumbnail_url,
        author_name: data.author_name,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Extract info from YouTube oEmbed
 */
export async function getYouTubeOembed(videoUrl: string): Promise<{
  success: boolean;
  data?: { title?: string; thumbnail_url?: string; author_name?: string };
  error?: string;
}> {
  try {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      return { success: false, error: 'Invalid YouTube URL' };
    }
    
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(oembedUrl);
    
    if (!response.ok) {
      return { success: false, error: `YouTube oEmbed error: ${response.status}` };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data: {
        title: data.title,
        thumbnail_url: data.thumbnail_url,
        author_name: data.author_name,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// ============================================================================
// Web Scraping (Public Pages Only)
// ============================================================================

/**
 * Extract business info from a public website
 */
export async function scrapeBusinessWebsite(url: string): Promise<MiningResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SiteForge-AI/1.0 (+https://siteforge.ai)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    
    if (!response.ok) {
      return {
        success: false,
        confidence: 0,
        error: `HTTP error: ${response.status}`,
      };
    }
    
    const html = await response.text();
    
    // Extract basic info using regex (simplified - production would use cheerio)
    const info: BusinessInfo = {};
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      info.name = titleMatch[1].trim();
    }
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (descMatch) {
      info.description = descMatch[1].trim();
    }
    
    // Extract OG image
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      info.coverImage = ogImageMatch[1];
    }
    
    // Extract contact info patterns (simplified)
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emailMatch && emailMatch.length > 0) {
      if (!info.contact) info.contact = {};
      info.contact.email = emailMatch[0];
    }
    
    // Extract phone patterns
    const phoneMatch = html.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g);
    if (phoneMatch && phoneMatch.length > 0) {
      if (!info.contact) info.contact = {};
      info.contact.phone = phoneMatch[0].replace(/[^\d+]/g, '');
    }
    
    // Extract social links
    const socialPatterns = {
      facebook: /facebook\.com\/[^\s"'<>]+/gi,
      twitter: /twitter\.com\/[^\s"'<>]+/gi,
      instagram: /instagram\.com\/[^\s"'<>]+/gi,
      linkedin: /linkedin\.com\/in\/[^\s"'<>]+/gi,
    };
    
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        if (!info.social) info.social = {};
        (info.social as Record<string, string>)[platform] = `https://${matches[0]}`;
      }
    }
    
    return {
      success: true,
      data: info,
      source: url,
      confidence: calculateConfidence(info),
    };
  } catch (error) {
    return {
      success: false,
      confidence: 0,
      error: String(error),
    };
  }
}

// ============================================================================
// AI-Assisted Extraction
// ============================================================================

/**
 * Use AI to extract structured business info from raw text
 */
export async function extractWithAI(
  content: string,
  source: string,
  apiKey: string
): Promise<{
  success: boolean;
  data?: BusinessInfo;
  error?: string;
}> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Extract structured business information from the following content.

Source: ${source}

Content:
${content.slice(0, 10000)}

Extract as much information as possible about:
- Business name
- Description/tagline
- Services or products offered
- Contact information (email, phone, address)
- Social media links
- Operating hours
- Any testimonials or reviews
- Pricing information

Return valid JSON matching this schema:
${JSON.stringify(BusinessInfoSchema.shape, null, 2)}

If information is not available, omit the field. Return null for fields you cannot determine.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    if (!response.text) {
      return { success: false, error: 'Empty response from AI' };
    }
    
    const parsed = JSON.parse(response.text);
    const validated = BusinessInfoSchema.parse(parsed);
    
    return { success: true, data: validated };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate confidence score based on extracted data
 */
function calculateConfidence(info: BusinessInfo): number {
  let score = 0;
  
  if (info.name) score += 20;
  if (info.description) score += 20;
  if (info.logo || info.coverImage) score += 15;
  if (info.contact?.email) score += 10;
  if (info.contact?.phone) score += 10;
  if (info.contact?.address) score += 10;
  if (info.services?.length) score += 5;
  if (info.social?.facebook || info.social?.instagram) score += 10;
  
  return Math.min(100, score);
}

// ============================================================================
// Complete Mining Pipeline
// ============================================================================

/**
 * Mine business info from multiple sources
 */
export async function mineBusinessInfo(
  websiteUrl: string,
  options?: {
    apiKey?: string;
    includeSocial?: boolean;
  }
): Promise<{
  success: boolean;
  data?: BusinessInfo;
  sources: string[];
  errors: string[];
}> {
  const sources: string[] = [];
  const errors: string[] = [];
  const mergedData: BusinessInfo = {};
  
  try {
    // 1. Scrape the main website
    const scrapeResult = await scrapeBusinessWebsite(websiteUrl);
    
    if (scrapeResult.success && scrapeResult.data) {
      Object.assign(mergedData, scrapeResult.data);
      if (scrapeResult.source) sources.push(scrapeResult.source);
    } else if (scrapeResult.error) {
      errors.push(`Website scrape: ${scrapeResult.error}`);
    }
    
    // 2. Try to get social media oEmbed data
    if (options?.includeSocial && mergedData.social) {
      if (mergedData.social.instagram) {
        const igResult = await getInstagramOembed(mergedData.social.instagram);
        if (igResult.success) {
          sources.push('instagram-oembed');
        }
      }
      
      if (mergedData.social.youtube) {
        const ytResult = await getYouTubeOembed(mergedData.social.youtube);
        if (ytResult.success && ytResult.data) {
          sources.push('youtube-oembed');
        }
      }
    }
    
    // 3. Use AI to enhance extraction if API key provided
    if (options?.apiKey && websiteUrl) {
      const htmlResponse = await fetch(websiteUrl).catch(() => null);
      const html = await htmlResponse?.text().catch(() => null) || '';
      
      if (html) {
        const aiResult = await extractWithAI(html, websiteUrl, options.apiKey);
        
        if (aiResult.success && aiResult.data) {
          // Merge AI data, preferring more complete data
          for (const [key, value] of Object.entries(aiResult.data)) {
            if (value && !mergedData[key as keyof BusinessInfo]) {
              (mergedData as Record<string, unknown>)[key] = value;
            }
          }
          sources.push('ai-extraction');
        } else if (aiResult.error) {
          errors.push(`AI extraction: ${aiResult.error}`);
        }
      }
    }
    
    return {
      success: Object.keys(mergedData).length > 0,
      data: mergedData,
      sources,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      sources,
      errors: [...errors, String(error)],
    };
  }
}
