-- CreateTable
CREATE TABLE "term" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_card" (
    "id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "student_account_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "comment" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "issued_by_account_id" UUID NOT NULL,
    "replaced_issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_card_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "term_school_id_start_date_idx" ON "term"("school_id", "start_date");

-- CreateIndex
CREATE INDEX "report_card_student_account_id_idx" ON "report_card"("student_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_card_term_id_student_account_id_key" ON "report_card"("term_id", "student_account_id");

-- AddForeignKey
ALTER TABLE "term" ADD CONSTRAINT "term_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school_profile"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card" ADD CONSTRAINT "report_card_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card" ADD CONSTRAINT "report_card_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_card" ADD CONSTRAINT "report_card_student_account_id_fkey" FOREIGN KEY ("student_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
