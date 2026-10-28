-- CreateTable
CREATE TABLE "WhatsAppFollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "sentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppFollowUp_userId_key_key" ON "WhatsAppFollowUp"("userId", "key");

-- CreateIndex
CREATE INDEX "WhatsAppFollowUp_reason_createdAt_idx" ON "WhatsAppFollowUp"("reason", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppFollowUp" ADD CONSTRAINT "WhatsAppFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
