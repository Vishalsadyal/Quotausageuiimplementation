-- CreateTable
CREATE TABLE "AgencyClient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAccount" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "linkId" TEXT,
    "linkUrl" TEXT,
    "linkPlan" "UserPlan",
    "linkAmountPaise" INTEGER,
    "linkStatus" TEXT NOT NULL DEFAULT 'none',
    "linkCreatedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgencyClient_userId_key" ON "AgencyClient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyClient_linkId_key" ON "AgencyClient"("linkId");

-- AddForeignKey
ALTER TABLE "AgencyClient" ADD CONSTRAINT "AgencyClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
