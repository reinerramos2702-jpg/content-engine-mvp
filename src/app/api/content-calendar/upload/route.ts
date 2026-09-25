import { NextRequest } from 'next/server';
import { POST as uploadContentPosts } from '@/app/api/content-posts/upload/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Alias conservado para el editor del calendario; comparte validación y RBAC. */
export function POST(req: NextRequest) {
  return uploadContentPosts(req);
}
