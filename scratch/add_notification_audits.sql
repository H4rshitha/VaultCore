-- Add missing notification_audits table and enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
        CREATE TYPE "NotificationType" AS ENUM ('EMAIL', 'SMS', 'PUSH');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
        CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "notification_audits" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "transactionId" TEXT,
    "notificationType" "NotificationType" NOT NULL DEFAULT 'EMAIL',
    "recipient" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "traceId" TEXT,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_audits_eventId_key" ON "notification_audits"("eventId");
CREATE INDEX IF NOT EXISTS "notification_audits_transactionId_idx" ON "notification_audits"("transactionId");
CREATE INDEX IF NOT EXISTS "notification_audits_recipient_idx" ON "notification_audits"("recipient");
CREATE INDEX IF NOT EXISTS "notification_audits_status_idx" ON "notification_audits"("status");
CREATE INDEX IF NOT EXISTS "notification_audits_createdAt_idx" ON "notification_audits"("createdAt");
