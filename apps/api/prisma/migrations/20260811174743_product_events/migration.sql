-- CreateTable
CREATE TABLE "product_event" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "account_id" UUID,
    "school_id" UUID,
    "payload" JSONB,
    "dedupe_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_event_dedupe_key_key" ON "product_event"("dedupe_key");

-- CreateIndex
CREATE INDEX "product_event_type_occurred_at_idx" ON "product_event"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "product_event_school_id_occurred_at_idx" ON "product_event"("school_id", "occurred_at");

-- CreateIndex
CREATE INDEX "product_event_account_id_occurred_at_idx" ON "product_event"("account_id", "occurred_at");
