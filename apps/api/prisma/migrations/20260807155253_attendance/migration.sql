-- CreateEnum
CREATE TYPE "AttendanceState" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateTable
CREATE TABLE "attendance_entry" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "student_account_id" UUID NOT NULL,
    "on_date" DATE NOT NULL,
    "state" "AttendanceState" NOT NULL,
    "leave_application_id" UUID,
    "taken_by_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_entry_class_id_on_date_idx" ON "attendance_entry"("class_id", "on_date");

-- CreateIndex
CREATE INDEX "attendance_entry_student_account_id_on_date_idx" ON "attendance_entry"("student_account_id", "on_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_entry_class_id_student_account_id_on_date_key" ON "attendance_entry"("class_id", "student_account_id", "on_date");

-- AddForeignKey
ALTER TABLE "attendance_entry" ADD CONSTRAINT "attendance_entry_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_entry" ADD CONSTRAINT "attendance_entry_student_account_id_fkey" FOREIGN KEY ("student_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_entry" ADD CONSTRAINT "attendance_entry_leave_application_id_fkey" FOREIGN KEY ("leave_application_id") REFERENCES "leave_application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
