CREATE TABLE IF NOT EXISTS "SimulationRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "inputContract" JSONB NOT NULL,
  "metrics" JSONB,
  "bottlenecks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "failureReason" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SimulationRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArchitectureVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SimulationRun_projectId_createdAt_idx" ON "SimulationRun" ("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "SimulationRun_versionId_createdAt_idx" ON "SimulationRun" ("versionId", "createdAt");

CREATE TABLE IF NOT EXISTS "SimulationRunEvent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "runId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "atSecond" INTEGER NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "componentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SimulationRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SimulationRunEvent_runId_sequence_idx" ON "SimulationRunEvent" ("runId", "sequence");
CREATE INDEX IF NOT EXISTS "SimulationRunEvent_runId_atSecond_idx" ON "SimulationRunEvent" ("runId", "atSecond");
