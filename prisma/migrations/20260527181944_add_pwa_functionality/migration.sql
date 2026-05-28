-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'synced';

-- AlterTable
ALTER TABLE "van_load" ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'synced';

-- CreateTable
CREATE TABLE "bill_submission" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "imageName" TEXT NOT NULL,
    "selectedItems" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',

    CONSTRAINT "bill_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_operation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "sync_operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "summary" JSONB NOT NULL,
    "itemDetails" JSONB NOT NULL,
    "paymentData" JSONB NOT NULL,
    "discrepancies" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_report_userId_date_key" ON "reconciliation_report"("userId", "date");

-- AddForeignKey
ALTER TABLE "bill_submission" ADD CONSTRAINT "bill_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_operation" ADD CONSTRAINT "sync_operation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
