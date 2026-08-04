-- CreateEnum
CREATE TYPE "ReportSubject" AS ENUM ('POST', 'COMMENT', 'MESSAGE', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "report" (
    "id" UUID NOT NULL,
    "reporter_account_id" UUID NOT NULL,
    "subject_type" "ReportSubject" NOT NULL,
    "subject_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_status_created_at_idx" ON "report"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_reporter_account_id_subject_type_subject_id_key" ON "report"("reporter_account_id", "subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_account_id_fkey" FOREIGN KEY ("reporter_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
