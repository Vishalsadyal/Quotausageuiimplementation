-- AlterEnum
ALTER TYPE "DiscountCodeType" ADD VALUE 'fixed_price';

-- AlterEnum
ALTER TYPE "DiscountCodeTarget" ADD VALUE 'plan_connect';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "planAfterExpiry" "UserPlan",
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralQualifiedAt" TIMESTAMP(3),
ADD COLUMN     "referredAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "DiscountCode" ADD COLUMN     "fixedPriceRupees" INTEGER;

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batch" INTEGER NOT NULL,
    "plan" "UserPlan" NOT NULL DEFAULT 'pro',
    "days" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralReward_status_idx" ON "ReferralReward"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_userId_batch_key" ON "ReferralReward"("userId", "batch");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

