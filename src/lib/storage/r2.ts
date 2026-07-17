/**
 * Cloudflare R2 Storage Client
 * 
 * R2 is used for storing large static assets:
 * - Elementor template ZIP files
 * - Template metadata JSON files
 * - Preview images
 * - Generated website assets
 */

import { S3Client } from "@aws-sdk/client-s3";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "siteforge-templates";

/**
 * Generate a signed URL for downloading a template file
 * URL expires after the specified duration
 */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // default 1 hour
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
 * Get file key for a template
 * Structure: kits/{kit-slug}/{file-name}
 */
export function getTemplateFileKey(kitSlug: string, fileName: string): string {
  return `kits/${kitSlug}/${fileName}`;
}

/**
 * Get file key for a kit's global styles
 */
export function getKitGlobalStylesKey(kitSlug: string): string {
  return `kits/${kitSlug}/global-styles.json`;
}
