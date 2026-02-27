CREATE TABLE IF NOT EXISTS "GradeReport" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "overallScore" INTEGER,
  "categoryScores" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "strengths" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "risks" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "deterministicNotes" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "actionItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "summary" TEXT,
  "aiProvider" TEXT,
  "aiModel" TEXT,
  "failureReason" TEXT,
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GradeReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GradeReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ArchitectureVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GradeReport_projectId_createdAt_idx" ON "GradeReport" ("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "GradeReport_versionId_createdAt_idx" ON "GradeReport" ("versionId", "createdAt");

CREATE TABLE IF NOT EXISTS "FeedbackItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "gradeReportId" UUID NOT NULL,
  "priority" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackItem_gradeReportId_fkey" FOREIGN KEY ("gradeReportId") REFERENCES "GradeReport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FeedbackItem_gradeReportId_createdAt_idx" ON "FeedbackItem" ("gradeReportId", "createdAt");
