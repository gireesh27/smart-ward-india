import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import {
  CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { env } from "./env";

/*
 * Two interchangeable drivers behind the same three functions:
 *  - local: files under UPLOAD_DIR (default; ideal for development and single-server installs)
 *  - s3:    any S3-compatible object store (MinIO, AWS S3, Cloudflare R2, …)
 * Either way files are private: they are only served through /api/files/:id after an access check.
 */

// ── local disk ──────────────────────────────────────────────────────────────
function localPath(key: string): string {
  const root = resolve(env().UPLOAD_DIR);
  const full = resolve(root, key);
  if (!full.startsWith(root + sep)) throw new Error("Invalid storage key");
  return full;
}

// ── S3 ──────────────────────────────────────────────────────────────────────
let client: S3Client | null = null;
function s3(): S3Client {
  if (client) return client;
  const e = env();
  client = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: e.S3_ACCESS_KEY_ID ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } : undefined,
  });
  return client;
}

let bucketReady: Promise<void> | null = null;
/** Optionally create the bucket on first use (S3_CREATE_BUCKET=true), so no separate setup container is needed. */
function ensureBucket(): Promise<void> {
  const e = env();
  if (!e.S3_CREATE_BUCKET) return Promise.resolve();
  bucketReady ??= (async () => {
    try {
      await s3().send(new HeadBucketCommand({ Bucket: e.S3_BUCKET }));
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404 && (err as Error).name !== "NotFound") throw err;
      await s3().send(new CreateBucketCommand({
        Bucket: e.S3_BUCKET,
        ...(e.S3_REGION !== "us-east-1" ? { CreateBucketConfiguration: { LocationConstraint: e.S3_REGION as BucketLocationConstraint } } : {}),
      }));
    }
  })().catch((err) => { bucketReady = null; throw err; });
  return bucketReady;
}

// ── public API ──────────────────────────────────────────────────────────────
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  if (env().STORAGE_DRIVER === "local") {
    const path = localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: "wx" }); // never overwrite an existing file
    return;
  }
  await ensureBucket();
  await s3().send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
}

/** Read a whole object, or an inclusive byte range of it. */
export async function getObject(key: string, range?: { start: number; end: number }): Promise<{ stream: ReadableStream; length?: number }> {
  if (env().STORAGE_DRIVER === "local") {
    const path = localPath(key);
    const info = await stat(path);
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? info.size - 1, info.size - 1);
    return { stream: Readable.toWeb(createReadStream(path, { start, end })) as unknown as ReadableStream, length: end - start + 1 };
  }
  const res = await s3().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }));
  if (!res.Body) throw new Error("Empty object body");
  return { stream: res.Body.transformToWebStream(), length: res.ContentLength };
}

export async function deleteObject(key: string) {
  if (env().STORAGE_DRIVER === "local") {
    await unlink(localPath(key)).catch((err: NodeJS.ErrnoException) => { if (err.code !== "ENOENT") throw err; });
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
}
