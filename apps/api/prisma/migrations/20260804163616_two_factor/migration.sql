-- CreateTable
CREATE TABLE "two_factor_secret" (
    "account_id" UUID NOT NULL,
    "secret" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_secret_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "recovery_code" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_challenge" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recovery_code_code_hash_key" ON "recovery_code"("code_hash");

-- CreateIndex
CREATE INDEX "recovery_code_account_id_idx" ON "recovery_code"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_challenge_token_hash_key" ON "two_factor_challenge"("token_hash");

-- CreateIndex
CREATE INDEX "two_factor_challenge_account_id_idx" ON "two_factor_challenge"("account_id");

-- CreateIndex
CREATE INDEX "two_factor_challenge_expires_at_idx" ON "two_factor_challenge"("expires_at");

-- AddForeignKey
ALTER TABLE "two_factor_secret" ADD CONSTRAINT "two_factor_secret_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_code" ADD CONSTRAINT "recovery_code_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "two_factor_secret"("account_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_challenge" ADD CONSTRAINT "two_factor_challenge_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
