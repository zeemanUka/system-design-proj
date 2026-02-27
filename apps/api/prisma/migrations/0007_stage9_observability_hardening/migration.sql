CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "statusCode" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_createdAt_idx" ON "AuditLog" ("resourceType", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "RequestTelemetry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "userId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RequestTelemetry_createdAt_idx" ON "RequestTelemetry" ("createdAt");
CREATE INDEX IF NOT EXISTS "RequestTelemetry_path_createdAt_idx" ON "RequestTelemetry" ("path", "createdAt");
CREATE INDEX IF NOT EXISTS "RequestTelemetry_statusCode_createdAt_idx" ON "RequestTelemetry" ("statusCode", "createdAt");
CREATE INDEX IF NOT EXISTS "RequestTelemetry_userId_createdAt_idx" ON "RequestTelemetry" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "JobTelemetry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "queueName" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "errorMessage" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "JobTelemetry_queueName_createdAt_idx" ON "JobTelemetry" ("queueName", "createdAt");
CREATE INDEX IF NOT EXISTS "JobTelemetry_jobType_createdAt_idx" ON "JobTelemetry" ("jobType", "createdAt");
CREATE INDEX IF NOT EXISTS "JobTelemetry_jobId_createdAt_idx" ON "JobTelemetry" ("jobId", "createdAt");
CREATE INDEX IF NOT EXISTS "JobTelemetry_state_createdAt_idx" ON "JobTelemetry" ("state", "createdAt");
