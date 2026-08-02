-- CreateTable
CREATE TABLE "media_object" (
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_object_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "media_object_claimed_at_created_at_idx" ON "media_object"("claimed_at", "created_at");

-- AddForeignKey
ALTER TABLE "media_object" ADD CONSTRAINT "media_object_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
