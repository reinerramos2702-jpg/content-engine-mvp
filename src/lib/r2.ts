import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export class R2ConfigurationError extends Error {
  constructor() {
    super('El almacenamiento de archivos no está configurado.');
    this.name = 'R2ConfigurationError';
  }
}

function ensureR2Config() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new R2ConfigurationError();
  }
  if (!BUCKET || !PUBLIC_URL) {
    throw new R2ConfigurationError();
  }
}

function safeKeySegment(value: string): string {
  const sanitized = value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return sanitized || 'workspace';
}

function safeExtension(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  return sanitized || 'bin';
}

export function buildContentAssetKey(workspaceId: string, extension: string): string {
  const workspace = safeKeySegment(workspaceId);
  const id = crypto.randomBytes(16).toString('hex');
  return `content-calendar/${workspace}/${id}.${safeExtension(extension)}`;
}

/** Evita asociar a un tenant una clave R2 emitida para otro workspace. */
export function isContentAssetKeyForWorkspace(r2Key: string, workspaceId: string): boolean {
  const prefix = `content-calendar/${safeKeySegment(workspaceId)}/`;
  return r2Key.startsWith(prefix)
    && /^content-calendar\/[a-zA-Z0-9_-]+\/[a-f0-9]{32}\.[a-z0-9]{1,10}$/.test(r2Key);
}

/** Sube un medio del calendario bajo un prefijo aislado por workspace. */
export async function uploadContentAsset(args: {
  body: Buffer | Uint8Array;
  contentType: string;
  workspaceId: string;
  extension: string;
}) {
  ensureR2Config();
  const key = buildContentAssetKey(args.workspaceId, args.extension);

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: args.body,
      ContentType: args.contentType,
    })
  );

  return {
    r2Key: key,
    publicUrl: `${PUBLIC_URL.replace(/\/$/, '')}/${key}`,
  };
}

export async function uploadAsset(args: {
  body: Buffer | Uint8Array;
  contentType: string;
  executionId: string;
  taskId: string;
  kind: string;
  ext: string;
}) {
  ensureR2Config();
  const id = crypto.randomBytes(8).toString('hex');
  const key = `executions/${args.executionId}/tasks/${args.taskId}/${args.kind}-${id}.${args.ext}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: args.body,
      ContentType: args.contentType,
    })
  );

  return {
    r2Key: key,
    publicUrl: `${PUBLIC_URL}/${key}`,
  };
}

export async function getDownloadUrl(r2Key: string, expiresInSec = 3600) {
  ensureR2Config();
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }), {
    expiresIn: expiresInSec,
  });
}

// Descarga remota → buffer → upload a R2 (para assets generados por APIs externas)
export async function ingestUrl(url: string, args: {
  executionId: string;
  taskId: string;
  kind: string;
  ext: string;
  contentType: string;
}) {
  if (url.startsWith('data:')) {
    const [, payload] = url.split(',');
    if (!payload) throw new Error('Invalid data URL asset');
    return uploadAsset({ ...args, body: Buffer.from(payload, 'base64') });
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to ingest ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return uploadAsset({ ...args, body: buf });
}
