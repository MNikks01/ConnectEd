-- CreateTable
CREATE TABLE "block" (
    "id" UUID NOT NULL,
    "blocker_account_id" UUID NOT NULL,
    "blocked_account_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_blocked_account_id_idx" ON "block"("blocked_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "block_blocker_account_id_blocked_account_id_key" ON "block"("blocker_account_id", "blocked_account_id");

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_account_id_fkey" FOREIGN KEY ("blocker_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_account_id_fkey" FOREIGN KEY ("blocked_account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
