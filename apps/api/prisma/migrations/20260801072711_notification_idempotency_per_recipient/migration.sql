-- DropIndex
DROP INDEX "notification_event_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "notification_event_id_recipient_account_id_key" ON "notification"("event_id", "recipient_account_id");

