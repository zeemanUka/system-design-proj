CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "role" TEXT,
  "targetCompanies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "level" TEXT,
  "scenarioPreferences" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
