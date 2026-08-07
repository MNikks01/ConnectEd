-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('TEST', 'EXAM', 'ASSIGNMENT', 'PRACTICAL');

-- CreateTable
CREATE TABLE "assessment" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "max_score" DECIMAL(6,2) NOT NULL,
    "occurred_on" DATE NOT NULL,
    "author_account_id" UUID NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mark" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "student_account_id" UUID NOT NULL,
    "score" DECIMAL(6,2),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_class_id_published_at_idx" ON "assessment"("class_id", "published_at");

-- CreateIndex
CREATE INDEX "assessment_subject_id_idx" ON "assessment"("subject_id");

-- CreateIndex
CREATE INDEX "mark_student_account_id_idx" ON "mark"("student_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "mark_assessment_id_student_account_id_key" ON "mark"("assessment_id", "student_account_id");

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_author_account_id_fkey" FOREIGN KEY ("author_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark" ADD CONSTRAINT "mark_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mark" ADD CONSTRAINT "mark_student_account_id_fkey" FOREIGN KEY ("student_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
