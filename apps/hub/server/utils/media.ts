import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, rm, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// --- Types ---

interface BucketConfig {
  provider: "s3" | "r2" | "minio";
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string | null;
  pathPrefix: string;
}

export interface MediaFile {
  key: string;
  size: number;
  lastModified: Date | null;
}

export interface ListResult {
  files: MediaFile[];
  cursor: string | null;
}

export type BucketStatus =
  | { enabled: false }
  | { enabled: true; provider: string; bucket: string; region: string; publicUrl: string | null };

// --- Config loading ---

function loadBucketConfig(): BucketConfig | null {
  const provider = process.env.BUCKET_PROVIDER?.toLowerCase() as "s3" | "r2" | "minio" | undefined;
  const endpoint = process.env.BUCKET_ENDPOINT;
  const bucket = process.env.BUCKET_NAME;
  const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY;

  if (!provider || !endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }

  let pathPrefix = process.env.BUCKET_PATH_PREFIX?.trim() || "";
  if (pathPrefix && !pathPrefix.endsWith("/")) pathPrefix += "/";

  return {
    provider,
    endpoint,
    region: process.env.BUCKET_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    publicUrl: process.env.BUCKET_PUBLIC_URL?.replace(/\/+$/, "") || null,
    pathPrefix
  };
}

// --- Singleton ---

let instance: MediaService | null = null;

export function getMediaService(): MediaService {
  if (!instance) {
    instance = new MediaService();
  }
  return instance;
}

export function isBucketEnabled(): boolean {
  return loadBucketConfig() !== null;
}

// --- Service class ---

class MediaService {
  private config: BucketConfig | null;
  private s3: S3Client | null = null;

  constructor() {
    this.config = loadBucketConfig();
    if (this.config) {
      const usePathStyle = this.config.provider === "minio" || this.config.provider === "r2";
      this.s3 = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        },
        forcePathStyle: usePathStyle,
        // R2 and MinIO don't support SDK v3 default checksum headers
        ...(usePathStyle ? {
          requestChecksumCalculation: "WHEN_REQUIRED" as const,
          responseChecksumValidation: "WHEN_REQUIRED" as const
        } : {})
      });
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getBucketStatus(): BucketStatus {
    if (!this.config) return { enabled: false };
    return {
      enabled: true,
      provider: this.config.provider,
      bucket: this.config.bucket,
      region: this.config.region,
      publicUrl: this.config.publicUrl
    };
  }

  // --- Core operations ---

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const fullKey = this.prefixedKey(key);

    if (this.s3 && this.config) {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: fullKey,
        Body: buffer,
        ContentType: contentType
      }));
      return this.getPublicUrl(key);
    }

    // Local fallback
    const localPath = this.localPath(key);
    await mkdir(join(localPath, ".."), { recursive: true });
    await writeFile(localPath, buffer);
    return `/uploads/media/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (this.s3 && this.config) {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: this.prefixedKey(key)
      }));
      return;
    }

    await rm(this.localPath(key), { force: true });
  }

  async list(prefix?: string, cursor?: string, limit = 200): Promise<ListResult> {
    if (this.s3 && this.config) {
      const fullPrefix = this.config.pathPrefix + (prefix || "");
      const result = await this.s3.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: fullPrefix,
        MaxKeys: limit,
        ContinuationToken: cursor || undefined
      }));
      const prefixLen = this.config.pathPrefix.length;
      return {
        files: (result.Contents || []).map((obj) => ({
          key: (obj.Key || "").slice(prefixLen),
          size: obj.Size || 0,
          lastModified: obj.LastModified || null
        })),
        cursor: result.NextContinuationToken || null
      };
    }

    // Local: recursive readdir
    const baseDir = this.localBaseDir();
    const searchDir = prefix ? join(baseDir, prefix) : baseDir;
    const files = await this.recursiveReaddir(searchDir, baseDir);
    return { files: files.slice(0, limit), cursor: null };
  }

  getPublicUrl(key: string): string {
    if (this.config?.publicUrl) {
      return `${this.config.publicUrl}/${this.prefixedKey(key)}`;
    }
    if (this.config) {
      return `${this.config.endpoint}/${this.config.bucket}/${this.prefixedKey(key)}`;
    }
    return `/uploads/media/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.s3 && this.config) {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.prefixedKey(key)
      });
      return s3GetSignedUrl(this.s3, command, { expiresIn });
    }
    return this.getPublicUrl(key);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.s3 || !this.config) {
      return { ok: false, error: "No bucket configured." };
    }
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }

  // --- Helpers ---

  private prefixedKey(key: string): string {
    return (this.config?.pathPrefix || "") + key;
  }

  private localBaseDir(): string {
    const currentDir = fileURLToPath(new URL(".", import.meta.url));
    return join(currentDir, "../../public/uploads/media");
  }

  private localPath(key: string): string {
    return join(this.localBaseDir(), key);
  }

  private async recursiveReaddir(dir: string, baseDir: string): Promise<MediaFile[]> {
    const results: MediaFile[] = [];
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await this.recursiveReaddir(fullPath, baseDir);
        results.push(...sub);
      } else if (entry.isFile()) {
        try {
          const fileStat = await stat(fullPath);
          results.push({
            key: relative(baseDir, fullPath),
            size: fileStat.size,
            lastModified: fileStat.mtime
          });
        } catch {
          // skip inaccessible files
        }
      }
    }

    return results;
  }
}

// --- Key generation helpers ---

export function avatarKey(userId: string, ext: string): string {
  return `avatars/${userId}.${ext}`;
}

export function themeLogoKey(slot: "logo" | "sidebar-logo", ext: string): string {
  return `theme/${slot}.${ext}`;
}

export function applicationUploadKey(flowId: string, fileId: string, ext: string): string {
  return `applications/${flowId}/${fileId}.${ext}`;
}

/**
 * Extracts the media key from a URL generated by MediaService.
 * Works for both bucket URLs (with publicUrl or endpoint) and local `/uploads/media/` paths.
 */
export function extractMediaKeyFromUrl(url: string): string | null {
  // Local path: /uploads/media/avatars/xyz.jpg
  const localPrefix = "/uploads/media/";
  if (url.startsWith(localPrefix)) {
    return url.slice(localPrefix.length);
  }

  // Bucket URL: try to extract key after known prefixes
  // The key is always the last path segments matching our known patterns
  const patterns = ["avatars/", "theme/", "applications/", "cms/"];
  for (const pattern of patterns) {
    const idx = url.indexOf(pattern);
    if (idx !== -1) {
      return url.slice(idx);
    }
  }

  return null;
}
