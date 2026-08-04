/**
 * Storage provider types
 */

export interface UploadResult {
  url: string;
  key: string;
}

export interface FileInfo {
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

export interface StorageProvider {
  uploadFile(key: string, data: Buffer | Uint8Array | string, contentType: string): Promise<UploadResult>;
  getPublicUrl(key: string): string;
  getSignedDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  listFiles(prefix?: string): Promise<FileInfo[]>;
  downloadFile(key: string): Promise<Buffer | null>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
}
