-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "ticketStatus" TEXT,
ADD COLUMN "adminReply" TEXT NOT NULL DEFAULT '',
ADD COLUMN "repliedAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Feedback_ticketStatus_idx" ON "Feedback"("ticketStatus");

-- Ratings already sent that count as tickets (1-3 stars, or "Bugs / errors" picked) start open.
UPDATE "Feedback" SET "ticketStatus" = 'open' WHERE "rating" <= 3 OR 'Bugs / errors' = ANY("tags");
