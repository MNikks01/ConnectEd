-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "timetable" ALTER COLUMN "image_key" DROP NOT NULL;

-- CreateTable
CREATE TABLE "timetable_period" (
    "id" UUID NOT NULL,
    "timetable_id" UUID NOT NULL,
    "day" "Weekday" NOT NULL,
    "starts_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "subject_id" UUID,
    "label" TEXT,

    CONSTRAINT "timetable_period_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_period_timetable_id_idx" ON "timetable_period"("timetable_id");

-- CreateIndex
CREATE INDEX "timetable_period_subject_id_idx" ON "timetable_period"("subject_id");

-- AddForeignKey
ALTER TABLE "timetable_period" ADD CONSTRAINT "timetable_period_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_period" ADD CONSTRAINT "timetable_period_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
