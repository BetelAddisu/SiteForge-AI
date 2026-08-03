/**
 * Storage Abstraction Layer
 *
 * Unified interface for all storage operations.
 * Every file that reads/writes files to R2, Supabase Storage, or any
 * future provider MUST go through this interface — never a provider SDK
 * directly.
 *
 * Usage:
 *   import { getStorageProvider } from '@/lib/storage';
 *   const provider = await getStorageProvider();
 *   await provider.uploadFile('path/to/file.json', data, 'application/json');
 *
 * The implementation is selected by STORAGE_PROVIDER env var:
 *   "r2"        → Cloudflare R2 (default for template files, generated content)
 *   "supabase"  → Supabase Storage (legacy, for existing media assets)
 *
 * To add a new provider, implement StorageProvider and add it to getProvider().
 */

import type { StorageProvider, UploadResult, FileInfo } from './types';

export type { StorageProvider, UploadResult, FileInfo };

let cachedProvider: StorageProvider | null = null;

/**
 * Get the configured storage provider singleton.
 * Provider is selected by the STORAGE_PROVIDER env var (default: "r2").
 */
export async function getStorageProvider(): Promise<StorageProvider> {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.STORAGE_PROVIDER || 'r2';

  switch (providerName) {
    case 'r2': {
      const { createR2StorageProvider } = await import('./r2');
      cachedProvider = createR2StorageProvider();
      break;
    }
    case 'supabase': {
      const { createSupabaseStorageProvider } = await import('./supabase');
      cachedProvider = createSupabaseStorageProvider();
      break;
    }
    default:
      throw new Error(`Unknown storage provider: ${providerName}. Supported: r2, supabase`);
  }

  return cachedProvider!;
}
