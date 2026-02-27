CREATE TABLE IF NOT EXISTS "ReportExport" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "baselineVersionId" UUID NOT NULL,
  "candidateVersionId" UUID NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'pdf',
  "fileName" TEXT NOT NULL,
  "reportSnapshot" JSONB NOT NULL,
  "shareToken" TEXT,
  "shareRevokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportExport_baselineVersionId_fkey" FOREIGN KEY ("baselineVersionId") REFERENCES "ArchitectureVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReportExport_candidateVersionId_fkey" FOREIGN KEY ("candidateVersionId") REFERENCES "ArchitectureVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReportExport_projectId_createdAt_idx" ON "ReportExport" ("projectId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReportExport_shareToken_key" ON "ReportExport" ("shareToken");
