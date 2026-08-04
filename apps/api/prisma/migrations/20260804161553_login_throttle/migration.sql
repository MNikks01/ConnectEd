-- CreateTable
CREATE TABLE "login_throttle" (
    "email_hash" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "blocked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_throttle_pkey" PRIMARY KEY ("email_hash")
);

-- CreateIndex
CREATE INDEX "login_throttle_last_failed_at_idx" ON "login_throttle"("last_failed_at");
