-- CreateTable
CREATE TABLE "worker_photos" (
    "profile_id" UUID NOT NULL,
    "media_type" VARCHAR(32) NOT NULL,
    "content" BYTEA NOT NULL,

    CONSTRAINT "worker_photos_pkey" PRIMARY KEY ("profile_id")
);

-- AddForeignKey
ALTER TABLE "worker_photos" ADD CONSTRAINT "worker_photos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

