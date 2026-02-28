CREATE TABLE IF NOT EXISTS "ProjectMember" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "invitedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "Project" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ProjectMember_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ProjectMember_invitedById_fkey"
    FOREIGN KEY ("invitedById")
    REFERENCES "User" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_userId_key"
  ON "ProjectMember" ("projectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_createdAt_idx"
  ON "ProjectMember" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_role_idx"
  ON "ProjectMember" ("projectId", "role");

CREATE TABLE IF NOT EXISTS "ProjectInvite" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "token" TEXT NOT NULL,
  "invitedById" UUID NOT NULL,
  "acceptedById" UUID,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectInvite_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "Project" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ProjectInvite_invitedById_fkey"
    FOREIGN KEY ("invitedById")
    REFERENCES "User" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "ProjectInvite_acceptedById_fkey"
    FOREIGN KEY ("acceptedById")
    REFERENCES "User" ("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectInvite_token_key" ON "ProjectInvite" ("token");
CREATE INDEX IF NOT EXISTS "ProjectInvite_projectId_status_createdAt_idx"
  ON "ProjectInvite" ("projectId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ProjectInvite_email_status_createdAt_idx"
  ON "ProjectInvite" ("email", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "VersionComment" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "versionId" UUID NOT NULL,
  "nodeId" TEXT NOT NULL,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "mentionUserIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersionComment_projectId_fkey"
    FOREIGN KEY ("projectId")
    REFERENCES "Project" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "VersionComment_versionId_fkey"
    FOREIGN KEY ("versionId")
    REFERENCES "ArchitectureVersion" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "VersionComment_authorId_fkey"
    FOREIGN KEY ("authorId")
    REFERENCES "User" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "VersionComment_projectId_versionId_createdAt_idx"
  ON "VersionComment" ("projectId", "versionId", "createdAt");
CREATE INDEX IF NOT EXISTS "VersionComment_versionId_nodeId_createdAt_idx"
  ON "VersionComment" ("versionId", "nodeId", "createdAt");
CREATE INDEX IF NOT EXISTS "VersionComment_authorId_createdAt_idx"
  ON "VersionComment" ("authorId", "createdAt");
