ALTER TABLE "User"
ADD COLUMN "profileImageUrl" TEXT,
ADD COLUMN "profileImageKey" TEXT;

ALTER TABLE "Advertisement"
ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 8;

CREATE TABLE "AdvertisementMedia" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "mediaType" TEXT NOT NULL DEFAULT 'IMAGE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvertisementMedia_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdvertisementMedia" ("id", "advertisementId", "url", "objectKey", "mediaType", "sortOrder")
SELECT
    'legacy_' || "id",
    "id",
    "mediaUrl",
    "mediaKey",
    COALESCE("mediaType", 'IMAGE'),
    0
FROM "Advertisement"
WHERE "mediaUrl" IS NOT NULL;

CREATE TABLE "StaffMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT,
    "imageUrl" TEXT,
    "imageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteUpdate" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteUpdateMedia" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "objectKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteUpdateMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdvertisementMedia_advertisementId_sortOrder_idx"
ON "AdvertisementMedia"("advertisementId", "sortOrder");
CREATE INDEX "StaffMessage_createdAt_idx" ON "StaffMessage"("createdAt");
CREATE INDEX "SiteUpdate_createdAt_idx" ON "SiteUpdate"("createdAt");
CREATE INDEX "SiteUpdateMedia_updateId_sortOrder_idx" ON "SiteUpdateMedia"("updateId", "sortOrder");

ALTER TABLE "AdvertisementMedia"
ADD CONSTRAINT "AdvertisementMedia_advertisementId_fkey"
FOREIGN KEY ("advertisementId") REFERENCES "Advertisement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffMessage"
ADD CONSTRAINT "StaffMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteUpdate"
ADD CONSTRAINT "SiteUpdate_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteUpdateMedia"
ADD CONSTRAINT "SiteUpdateMedia_updateId_fkey"
FOREIGN KEY ("updateId") REFERENCES "SiteUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
