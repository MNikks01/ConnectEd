-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'BUILDING', 'READY', 'FAILED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'ERASED';

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'ACCOUNT';

-- CreateTable
CREATE TABLE "data_export" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "object_key" TEXT,
    "size_bytes" INTEGER,
    "error" TEXT,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_export_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erasure_request" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "reason" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erasure_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_export_account_id_requested_at_idx" ON "data_export"("account_id", "requested_at");

-- CreateIndex
CREATE INDEX "data_export_status_requested_at_idx" ON "data_export"("status", "requested_at");

-- CreateIndex
CREATE INDEX "erasure_request_account_id_requested_at_idx" ON "erasure_request"("account_id", "requested_at");

-- CreateIndex
CREATE INDEX "erasure_request_scheduled_for_idx" ON "erasure_request"("scheduled_for");

-- AddForeignKey
ALTER TABLE "data_export" ADD CONSTRAINT "data_export_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erasure_request" ADD CONSTRAINT "erasure_request_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
