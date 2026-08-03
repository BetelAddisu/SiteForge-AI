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
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadResult, FileInfo } from './types';

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

// =============================================================================
// StorageProvider Implementation (Abstraction Layer)
// =============================================================================

/**
 * Create an R2-backed StorageProvider that conforms to the unified interface.
 * Use this via getStorageProvider() in lib/storage/index.ts rather than
 * calling the raw functions above directly.
 */
export function createR2StorageProvider(): StorageProvider {
  return {
    async uploadFile(
      key: string,
      data: Buffer | Uint8Array | string,
      contentType: string
    ): Promise<UploadResult> {
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
      });
      await r2.send(command);
      const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 86400 });
      return { url, key };
    },

    getPublicUrl(key: string): string {
      return `${process.env.R2_PUBLIC_URL || ''}/${key}`;
    },

    async listFiles(prefix?: string): Promise<FileInfo[]> {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
      });
      const response = await r2.send(command);
      return (response.Contents || []).map(obj => ({
        key: obj.Key || '',
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
      })).filter(f => f.key !== '');
    },

    async downloadFile(key: string): Promise<Buffer | null> {
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
    },

    async deleteFile(key: string): Promise<void> {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      });
      await r2.send(command);
    },

    async fileExists(key: string): Promise<boolean> {
      try {
        const command = new GetObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
        });
        await r2.send(command);
        return true;
      } catch {
        return false;
      }
    },
  };
}
