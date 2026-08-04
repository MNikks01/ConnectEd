-- AlterTable
ALTER TABLE "account" ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "account_is_platform_admin_idx" ON "account"("is_platform_admin");

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
