-- BLOQUE 2A: calendario de contenido y estados visuales del flujo.
-- Migración local preparada manualmente. Aplicar únicamente con migrate deploy aprobado.

CREATE TYPE "ContentPostStatus" AS ENUM ('draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'error');

CREATE TABLE "ContentCalendarSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Caracas',
    "defaultPostTime" TEXT NOT NULL DEFAULT '18:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentCalendarSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "status" "ContentPostStatus" NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "networks" TEXT[] NOT NULL DEFAULT ARRAY['instagram']::TEXT[],
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPostMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "r2Key" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "mimeType" TEXT,
    "fileName" TEXT,
    "sizeBytes" INTEGER,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPostMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentCalendarSettings_workspaceId_key" ON "ContentCalendarSettings"("workspaceId");
CREATE INDEX "ContentPost_workspaceId_scheduledFor_idx" ON "ContentPost"("workspaceId", "scheduledFor");
CREATE INDEX "ContentPost_workspaceId_status_idx" ON "ContentPost"("workspaceId", "status");
CREATE INDEX "ContentPostMedia_postId_sortIndex_idx" ON "ContentPostMedia"("postId", "sortIndex");

ALTER TABLE "ContentCalendarSettings" ADD CONSTRAINT "ContentCalendarSettings_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentPostMedia" ADD CONSTRAINT "ContentPostMedia_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
