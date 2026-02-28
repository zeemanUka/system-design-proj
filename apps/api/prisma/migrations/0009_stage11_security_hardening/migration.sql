-- Stage 11 security hardening
ALTER TABLE "User"
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockoutUntil" TIMESTAMP(3);
