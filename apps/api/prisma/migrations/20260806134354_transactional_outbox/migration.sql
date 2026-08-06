-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_event_id_key" ON "outbox_event"("event_id");

-- CreateIndex
CREATE INDEX "outbox_event_published_at_created_at_idx" ON "outbox_event"("published_at", "created_at");
