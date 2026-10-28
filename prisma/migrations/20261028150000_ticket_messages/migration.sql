-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "lastMessageBy" TEXT,
ADD COLUMN "lastMessageAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketMessage_feedbackId_createdAt_idx" ON "TicketMessage"("feedbackId", "createdAt");

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replies already sent become the first message of their ticket.
INSERT INTO "TicketMessage" ("id", "feedbackId", "author", "body", "createdAt")
SELECT 'migrated_' || "id", "id", 'admin', "adminReply", COALESCE("repliedAt", CURRENT_TIMESTAMP)
FROM "Feedback"
WHERE "adminReply" <> '';

UPDATE "Feedback" SET "lastMessageBy" = 'admin', "lastMessageAt" = COALESCE("repliedAt", CURRENT_TIMESTAMP)
WHERE "adminReply" <> '';
