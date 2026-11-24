ALTER TABLE "User"
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

CREATE TABLE "CommunityMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectConversation" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectConversationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectConversation_pairKey_key" ON "DirectConversation"("pairKey");
CREATE INDEX "DirectConversation_channel_updatedAt_idx" ON "DirectConversation"("channel", "updatedAt");
CREATE INDEX "DirectConversation_claimedById_idx" ON "DirectConversation"("claimedById");
CREATE UNIQUE INDEX "DirectConversationMember_conversationId_userId_key" ON "DirectConversationMember"("conversationId", "userId");
CREATE INDEX "DirectConversationMember_userId_conversationId_idx" ON "DirectConversationMember"("userId", "conversationId");
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");
CREATE INDEX "CommunityMessage_createdAt_idx" ON "CommunityMessage"("createdAt");
CREATE UNIQUE INDEX "PasswordResetOtp_email_key" ON "PasswordResetOtp"("email");
CREATE INDEX "PasswordResetOtp_expiresAt_idx" ON "PasswordResetOtp"("expiresAt");

ALTER TABLE "CommunityMessage"
ADD CONSTRAINT "CommunityMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectConversation"
ADD CONSTRAINT "DirectConversation_claimedById_fkey"
FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DirectConversationMember"
ADD CONSTRAINT "DirectConversationMember_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectConversationMember"
ADD CONSTRAINT "DirectConversationMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage"
ADD CONSTRAINT "DirectMessage_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DirectMessage"
ADD CONSTRAINT "DirectMessage_senderId_fkey"
FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
