ALTER TABLE "User"
ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "emailStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailLastAttemptAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailError" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "youthSupported" INTEGER NOT NULL DEFAULT 20,
    "familiesSupported" INTEGER NOT NULL DEFAULT 23,
    "villagesReached" INTEGER NOT NULL DEFAULT 10,
    "whatsappNumber" TEXT NOT NULL DEFAULT '256760597356',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Advertisement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "text" TEXT,
    "mediaType" TEXT,
    "mediaUrl" TEXT,
    "mediaKey" TEXT,
    "targetUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportConversation_userId_key" ON "SupportConversation"("userId");
CREATE INDEX "UserNotification_userId_createdAt_idx" ON "UserNotification"("userId", "createdAt");
CREATE INDEX "UserNotification_emailStatus_createdAt_idx" ON "UserNotification"("emailStatus", "createdAt");
CREATE INDEX "Advertisement_isActive_sortOrder_idx" ON "Advertisement"("isActive", "sortOrder");
CREATE INDEX "SupportConversation_updatedAt_idx" ON "SupportConversation"("updatedAt");
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");

ALTER TABLE "UserNotification"
ADD CONSTRAINT "UserNotification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportConversation"
ADD CONSTRAINT "SupportConversation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportMessage"
ADD CONSTRAINT "SupportMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SiteSettings" (
    "id", "youthSupported", "familiesSupported", "villagesReached", "whatsappNumber", "updatedAt"
) VALUES (
    'default', 20, 23, 10, '256760597356', CURRENT_TIMESTAMP
);
