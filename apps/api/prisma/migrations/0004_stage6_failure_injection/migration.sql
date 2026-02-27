ALTER TABLE "SimulationRun"
  ADD COLUMN "baselineRunId" UUID,
  ADD COLUMN "failureProfile" JSONB,
  ADD COLUMN "blastRadius" JSONB;

ALTER TABLE "SimulationRun"
  ADD CONSTRAINT "SimulationRun_baselineRunId_fkey"
  FOREIGN KEY ("baselineRunId")
  REFERENCES "SimulationRun"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "SimulationRun_baselineRunId_createdAt_idx" ON "SimulationRun" ("baselineRunId", "createdAt");
