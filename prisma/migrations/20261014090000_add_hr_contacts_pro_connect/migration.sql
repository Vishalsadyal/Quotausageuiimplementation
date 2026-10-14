-- AlterEnum
ALTER TYPE "UserPlan" ADD VALUE 'connect';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hrContactsDailyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareOutreachContacts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HrContact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "recruiterName" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "postUrl" TEXT NOT NULL DEFAULT '',
    "postSnippet" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "waStatus" TEXT NOT NULL DEFAULT 'unknown',
    "emailStatus" TEXT NOT NULL DEFAULT 'unknown',
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "contributorCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrContactSighting" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "postUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrContactSighting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrContactDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrContactDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrContactRemoval" (
    "id" TEXT NOT NULL,
    "valueHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrContactRemoval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HrContact_lastSeenAt_idx" ON "HrContact"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrContact_kind_value_key" ON "HrContact"("kind", "value");

-- CreateIndex
CREATE INDEX "HrContactSighting_userId_idx" ON "HrContactSighting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HrContactSighting_contactId_userId_key" ON "HrContactSighting"("contactId", "userId");

-- CreateIndex
CREATE INDEX "HrContactDelivery_userId_day_idx" ON "HrContactDelivery"("userId", "day");

-- CreateIndex
CREATE INDEX "HrContactDelivery_contactId_createdAt_idx" ON "HrContactDelivery"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrContactDelivery_userId_contactId_key" ON "HrContactDelivery"("userId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "HrContactRemoval_valueHash_key" ON "HrContactRemoval"("valueHash");

-- AddForeignKey
ALTER TABLE "HrContactSighting" ADD CONSTRAINT "HrContactSighting_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "HrContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrContactSighting" ADD CONSTRAINT "HrContactSighting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrContactDelivery" ADD CONSTRAINT "HrContactDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrContactDelivery" ADD CONSTRAINT "HrContactDelivery_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "HrContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
