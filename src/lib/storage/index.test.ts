import { describe, it, expect } from 'vitest';
import { createR2StorageProvider } from './r2';
import { STORAGE_BUCKET, type StorageProvider } from './index';

describe('storage abstraction', () => {
  it('exposes the full StorageProvider contract on the R2 provider', () => {
    const provider = createR2StorageProvider();

    // Structural conformance check: every required interface method must exist.
    const required: Array<keyof StorageProvider> = [
      'uploadFile',
      'getPublicUrl',
      'getSignedDownloadUrl',
      'listFiles',
      'downloadFile',
      'deleteFile',
      'fileExists',
    ];
    for (const method of required) {
      expect(typeof (provider as unknown as Record<string, unknown>)[method], method).toBe('function');
    }
  });

  it('getSignedDownloadUrl is part of the contract (added for the migration)', () => {
    expect(typeof (createR2StorageProvider() as StorageProvider).getSignedDownloadUrl).toBe('function');
  });

  it('resolves a provider-agnostic bucket name', () => {
    // Defaults to 'templates' when no bucket env var is set.
    expect(STORAGE_BUCKET.length).toBeGreaterThan(0);
  });
});