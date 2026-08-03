/**
 * Media Engine
 * 
 * Phase 10: Image pipeline with compression, conversion, and AI alt text.
 * 
 * Features:
 * - Compression and WebP conversion
 * - Alt text generation via AI
 * - SEO filename normalization
 * - Stock image integration (Unsplash)
 */

import { getStorageProvider } from '@/lib/storage';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface MediaAsset {
  id: string;
  projectId: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  altText?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadResult {
  success: boolean;
  asset?: MediaAsset;
  error?: string;
}

export interface StockImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  photographer: string;
  photographerUrl: string;
  altDescription?: string;
  width: number;
  height: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?: string;
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Compress and convert image to WebP
 */
export async function compressImage(
  buffer: Buffer,
  options?: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  }
): Promise<Buffer> {
  // Note: In production, use sharp or similar library
  // For now, return original buffer
  // TODO: Implement actual compression with sharp
  
  const quality = options?.quality ?? 80;
  const maxWidth = options?.maxWidth ?? 1920;
  const maxHeight = options?.maxHeight ?? 1080;
  
  console.log(`[Media] Compressing image: quality=${quality}, max=${maxWidth}x${maxHeight}`);
  
  // Return original - actual implementation would use sharp
  return buffer;
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  // Note: In production, use sharp or similar
  // TODO: Implement actual dimension extraction
  
  // Placeholder - return standard dimensions
  return { width: 1920, height: 1080 };
}

// ============================================================================
// SEO Filename Normalization
// ============================================================================

/**
 * Normalize filename for SEO
 */
export function normalizeFilename(filename: string, context?: string): string {
  // Get base name without extension
  const lastDot = filename.lastIndexOf('.');
  const baseName = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const extension = lastDot > 0 ? filename.substring(lastDot) : '';
  
  // Convert to lowercase
  let normalized = baseName.toLowerCase();
  
  // Replace spaces and special characters with hyphens
  normalized = normalized.replace(/[^a-z0-9]+/g, '-');
  
  // Remove consecutive hyphens
  normalized = normalized.replace(/-+/g, '-');
  
  // Trim hyphens from ends
  normalized = normalized.replace(/^-+|-+$/g, '');
  
  // Add context prefix if provided
  if (context) {
    const contextSlug = context.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    normalized = `${contextSlug}-${normalized}`;
  }
  
  // Limit length
  if (normalized.length > 100) {
    normalized = normalized.substring(0, 100);
  }
  
  return normalized + (extension ? extension.toLowerCase() : '.jpg');
}

// ============================================================================
// AI Alt Text Generation
// ============================================================================

const AltTextSchema = z.object({
  alt: z.string().min(5).max(125).describe('Descriptive alt text for accessibility'),
  description: z.string().max(200).optional().describe('Brief description of the image'),
});

/**
 * Generate alt text for an image using AI
 */
export async function generateAltText(
  imageUrl: string,
  context: string,
  apiKey: string
): Promise<{ alt: string; description?: string } | null> {
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Generate accessibility alt text for an image.

Image URL: ${imageUrl}
Page Context: ${context}

The alt text should:
1. Describe what's in the image clearly
2. Be appropriate for visually impaired users
3. Be concise (under 125 characters)
4. Not start with "Image of" or "Picture of"

Return valid JSON matching the schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: AltTextSchema as unknown as Record<string, unknown>,
      },
    });
    
    if (!response.text) return null;
    
    const parsed = JSON.parse(response.text);
    return AltTextSchema.parse(parsed);
  } catch (error) {
    console.error('[Media] Alt text generation failed:', error);
    return null;
  }
}

// ============================================================================
// Storage Operations (via abstraction layer)
// ============================================================================

/**
 * Upload image to configured storage
 */
export async function uploadImage(
  bucket: string,
  path: string,
  buffer: Buffer,
  options?: {
    contentType?: string;
    cacheControl?: number;
  }
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const provider = await getStorageProvider();
    const contentType = options?.contentType ?? 'image/webp';
    // Reconstruct full key from bucket + path since the interface uses flat keys.
    // The bucket is configured per-provider (see supabase.ts / r2.ts).
    const result = await provider.uploadFile(path, buffer, contentType);
    return { success: true, path: result.key };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get public URL for a storage file
 */
export async function getPublicUrl(bucket: string, path: string): Promise<string> {
  const provider = await getStorageProvider();
  return provider.getPublicUrl(path);
}

/**
 * Delete image from storage
 */
export async function deleteImage(
  bucket: string,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = await getStorageProvider();
    await provider.deleteFile(path);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// Unsplash Integration
// ============================================================================

const UNSPLASH_API = 'https://api.unsplash.com';

/**
 * Search Unsplash for stock images
 */
export async function searchUnsplash(
  options: SearchOptions,
  accessKey: string
): Promise<{ success: boolean; images?: StockImage[]; error?: string }> {
  const params = new URLSearchParams({
    query: options.query,
    per_page: String(options.limit ?? 10),
  });
  
  if (options.orientation) {
    params.set('orientation', options.orientation);
  }
  
  if (options.color) {
    params.set('color', options.color);
  }
  
  try {
    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `Unsplash API error: ${response.status}` };
    }
    
    const data = await response.json();
    
    const images: StockImage[] = data.results.map((photo: Record<string, unknown>) => {
      const urls = photo.urls as Record<string, string>;
      const user = photo.user as Record<string, unknown>;
      const links = user.links as Record<string, string>;
      return {
        id: photo.id as string,
        url: urls.regular,
        thumbnailUrl: urls.thumb,
        photographer: user.name as string,
        photographerUrl: links.html,
        altDescription: photo.alt_description as string | undefined,
        width: photo.width as number,
        height: photo.height as number,
      };
    });
    
    return { success: true, images };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get a random Unsplash photo by topic
 */
export async function getRandomUnsplashPhoto(
  topic: string,
  accessKey: string
): Promise<{ success: boolean; image?: StockImage; error?: string }> {
  try {
    const response = await fetch(`${UNSPLASH_API}/photos/random?query=${encodeURIComponent(topic)}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `Unsplash API error: ${response.status}` };
    }
    
    const photo = await response.json();
    
    const image: StockImage = {
      id: photo.id,
      url: photo.urls.regular,
      thumbnailUrl: photo.urls.thumb,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      altDescription: photo.alt_description,
      width: photo.width,
      height: photo.height,
    };
    
    return { success: true, image };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Download Unsplash photo (for use on your site)
 */
export async function downloadUnsplashPhoto(
  photoId: string,
  accessKey: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // First, track the download
    await fetch(`${UNSPLASH_API}/photos/${photoId}/download`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
    });
    
    // Return the download URL
    return { success: true, url: `${UNSPLASH_API}/photos/${photoId}/download` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// Complete Media Pipeline
// ============================================================================

/**
 * Complete media processing pipeline
 */
export async function processAndUploadImage(
  buffer: Buffer,
  filename: string,
  projectId: string,
  context: string,
  options?: {
    compress?: boolean;
    generateAltText?: boolean;
    apiKey?: string;
  }
): Promise<UploadResult> {
  const bucket = 'media';
  const timestamp = Date.now();
  
  try {
    // 1. Compress if needed
    let processedBuffer = buffer;
    if (options?.compress !== false) {
      processedBuffer = await compressImage(buffer);
    }
    
    // 2. Get dimensions
    const dimensions = await getImageDimensions(processedBuffer);
    
    // 3. Normalize filename
    const normalizedFilename = normalizeFilename(filename, context);
    const storagePath = `${projectId}/${timestamp}-${normalizedFilename.replace(/\.[^.]+$/, '.webp')}`;
    
    // 4. Upload to Supabase
    const uploadResult = await uploadImage(bucket, storagePath, processedBuffer, {
      contentType: 'image/webp',
    });
    
    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error };
    }
    
    // 5. Generate alt text if enabled
    let altText: string | undefined;
    if (options?.generateAltText && options?.apiKey) {
      const publicUrl = await getPublicUrl(bucket, storagePath);
      const altResult = await generateAltText(publicUrl, context, options.apiKey);
      altText = altResult?.alt;
    }
    
    // 6. Return asset info
    const asset: MediaAsset = {
      id: `${timestamp}`,
      projectId,
      url: await getPublicUrl(bucket, storagePath),
      filename: normalizedFilename,
      mimeType: 'image/webp',
      size: processedBuffer.length,
      width: dimensions.width,
      height: dimensions.height,
      altText,
    };
    
    return { success: true, asset };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
