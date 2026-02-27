CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "Scenario" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  "expectedRps" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Project" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "scenarioId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Project_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Project_userId_createdAt_idx" ON "Project" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "ArchitectureVersion" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "parentVersionId" UUID,
  "versionNumber" INTEGER NOT NULL,
  "components" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "edges" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "trafficProfile" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArchitectureVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ArchitectureVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ArchitectureVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ArchitectureVersion_projectId_versionNumber_key" UNIQUE ("projectId", "versionNumber")
);

CREATE INDEX IF NOT EXISTS "ArchitectureVersion_projectId_createdAt_idx" ON "ArchitectureVersion" ("projectId", "createdAt");
