CREATE TABLE "publisher_photos" (
    "profile_id" UUID PRIMARY KEY REFERENCES "publisher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "media_type" VARCHAR(32) NOT NULL,
    "content" BYTEA NOT NULL
);
