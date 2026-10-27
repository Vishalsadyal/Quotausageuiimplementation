-- AlterTable
ALTER TABLE "User" ADD COLUMN "onboardingStep" INTEGER,
ADD COLUMN "onboardingStepAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "impersonatorId" TEXT;

-- CreateIndex
CREATE INDEX "Session_lastUsedAt_idx" ON "Session"("lastUsedAt");
