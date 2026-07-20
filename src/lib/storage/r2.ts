/**
 * Cloudflare R2 Storage Client
 * 
 * R2 is used for storing large static assets:
 * - Elementor template ZIP files
 * - Template metadata JSON files
 * - Preview images
 * - Generated website assets (Elementor JSON, previews)
 */

import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectAttributesCommand, ObjectStorageClass } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// R2 client for template storage
export const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "templates";

/**
 * Generate a signed URL for downloading a template file
 * URL expires after the specified duration
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  return getSignedUrl(r2, command, { expiresIn });
}

/**
 * Generate a signed URL for uploading a file
 */
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2, command, { expiresIn });
}

/**
 * Upload a file directly to R2
 */
export async function uploadFile(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string = 'application/json'
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await r2.send(command);
}

/**
 * Download a file from R2
 */
export async function downloadFile(key: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });

    const response = await r2.send(command);
    const data = await response.Body?.transformToByteArray();
    return data ? Buffer.from(data) : null;
  } catch (error) {
    console.error(`[R2] Error downloading ${key}:`, error);
    return null;
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  await r2.send(command);
}

/**
 * List files in a directory (prefix)
 */
export async function listFiles(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET,
    Prefix: prefix,
  });

  const response = await r2.send(command);
  return (response.Contents || []).map(obj => obj.Key || "").filter(Boolean);
}

/**
 * Check if a file exists in R2
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new GetObjectAttributesCommand({
      Bucket: R2_BUCKET,
      Key: key,
    });
    await r2.send(command);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Generated Content Storage (for websites)
// =============================================================================

/**
 * Storage keys for generated website content
 */
export function getGeneratedContentKey(projectId: string): string {
  return `projects/${projectId}/generated-content.json`;
}

export function getElementorDataKey(projectId: string): string {
  return `projects/${projectId}/elementor-data.json`;
}

export function getPreviewImageKey(projectId: string): string {
  return `projects/${projectId}/preview.png`;
}

export function getGeneratedZipKey(projectId: string): string {
  return `projects/${projectId}/website.zip`;
}

/**
 * Save generated content to R2
 */
export async function saveGeneratedContent(
  projectId: string,
  content: object
): Promise<string> {
  const key = getGeneratedContentKey(projectId);
  await uploadFile(key, JSON.stringify(content, null, 2), 'application/json');
  return key;
}

/**
 * Save Elementor data to R2
 */
export async function saveElementorData(
  projectId: string,
  data: object
): Promise<string> {
  const key = getElementorDataKey(projectId);
  await uploadFile(key, JSON.stringify(data, null, 2), 'application/json');
  return key;
}

/**
 * Get generated content from R2
 */
export async function getGeneratedContent(projectId: string): Promise<object | null> {
  const key = getGeneratedContentKey(projectId);
  const data = await downloadFile(key);
  return data ? JSON.parse(data.toString()) : null;
}

/**
 * Get Elementor data from R2
 */
export async function getElementorData(projectId: string): Promise<object | null> {
  const key = getElementorDataKey(projectId);
  const data = await downloadFile(key);
  return data ? JSON.parse(data.toString()) : null;
}

/**
 * Get preview image URL from R2
 */
export async function getPreviewImageUrl(projectId: string): Promise<string | null> {
  const key = getPreviewImageKey(projectId);
  const exists = await fileExists(key);
  if (!exists) return null;
  return getSignedDownloadUrl(key);
}

/**
 * Get template file key (flat structure)
 */
export function getTemplateFileKey(kitSlug: string, fileName: string): string {
  return fileName;
}

/**
 * Get kit global styles key (flat structure)
 */
export function getKitGlobalStylesKey(kitSlug: string): string {
  return `${kitSlug}-global-styles.json`;
}
