/**
 * Supabase Storage Provider
 *
 * For legacy assets stored in Supabase Storage (primarily user-uploaded media).
 * New storage should use R2 where possible.
 */

import { createClient } from '@supabase/supabase-js';
import type { StorageProvider, UploadResult, FileInfo } from './types';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getClient(): ReturnType<typeof createClient> {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Supabase credentials not configured for storage provider');
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'media';

export function createSupabaseStorageProvider(): StorageProvider {
  return {
    async uploadFile(
      key: string,
      data: Buffer | Uint8Array | string,
      contentType: string
    ): Promise<UploadResult> {
      const client = getClient();
      const { data: result, error } = await client.storage
        .from(BUCKET)
        .upload(key, data, {
          contentType,
          cacheControl: '31536000',
          upsert: true,
        });

      if (error) throw new Error(`Supabase upload failed: ${error.message}`);

      const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(result.path);
      return { url: urlData.publicUrl, key: result.path };
    },

    getPublicUrl(key: string): string {
      const client = getClient();
      const { data } = client.storage.from(BUCKET).getPublicUrl(key);
      return data.publicUrl;
    },

    async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
      const client = getClient();
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUrl(key, expiresIn);
      if (error || !data?.signedUrl) {
        // Fall back to the public URL if signed URLs are unavailable.
        return this.getPublicUrl(key);
      }
      return data.signedUrl;
    },

    async listFiles(prefix?: string): Promise<FileInfo[]> {
      const client = getClient();
      const { data, error } = await client.storage.from(BUCKET).list(prefix);

      if (error) throw new Error(`Supabase list failed: ${error.message}`);

      return (data || []).map(item => ({
        key: item.name,
        size: item.metadata?.size,
        lastModified: item.created_at ? new Date(item.created_at) : undefined,
      }));
    },

    async downloadFile(key: string): Promise<Buffer | null> {
      const client = getClient();
      const { data, error } = await client.storage.from(BUCKET).download(key);

      if (error) {
        console.error(`[SupabaseStorage] Error downloading ${key}:`, error.message);
        return null;
      }

      const buffer = await data.arrayBuffer();
      return Buffer.from(buffer);
    },

    async deleteFile(key: string): Promise<void> {
      const client = getClient();
      const { error } = await client.storage.from(BUCKET).remove([key]);

      if (error) throw new Error(`Supabase delete failed: ${error.message}`);
    },

    async fileExists(key: string): Promise<boolean> {
      const client = getClient();
      const { data, error } = await client.storage.from(BUCKET).list(undefined, {
        search: key,
      });

      if (error) return false;
      return data?.some(item => item.name === key) ?? false;
    },
  };
}
