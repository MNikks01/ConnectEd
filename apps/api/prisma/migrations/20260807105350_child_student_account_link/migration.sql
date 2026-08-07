-- AlterTable
ALTER TABLE "child" ADD COLUMN     "student_account_id" UUID;

-- CreateIndex
CREATE INDEX "child_student_account_id_idx" ON "child"("student_account_id");

-- AddForeignKey
ALTER TABLE "child" ADD CONSTRAINT "child_student_account_id_fkey" FOREIGN KEY ("student_account_id") REFERENCES "account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
