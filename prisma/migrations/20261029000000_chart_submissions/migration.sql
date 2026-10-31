BEGIN;

-- Existing rows must have their verified game numbers populated before deployment.
-- Never derive a game number from the old auto-increment ID.
ALTER TABLE "song" ADD COLUMN IF NOT EXISTS "gameSongId" TEXT;
ALTER TABLE "song" ALTER COLUMN "gameSongId" SET NOT NULL;
ALTER TABLE "song" ADD CONSTRAINT "song_gameSongId_check"
  CHECK ("gameSongId" ~ '^[0-9]{3,8}$' AND "gameSongId" <> '000');
ALTER TABLE "song" DROP CONSTRAINT "song_pkey";
ALTER TABLE "song" ADD CONSTRAINT "song_pkey" PRIMARY KEY ("gameSongId");
ALTER TABLE "song" DROP COLUMN "id";
ALTER TABLE "song" ADD COLUMN "creatorName" TEXT, ADD COLUMN "scoreTxt" TEXT, ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "chart_submission" (
    "id" UUID NOT NULL,
    "editTokenHash" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "txtContent" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "gameSongId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_quota" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_quota_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "chart_submission_gameSongId_idx" ON "chart_submission"("gameSongId");

-- CreateIndex
CREATE INDEX "chart_submission_status_updatedAt_idx" ON "chart_submission"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "submission_quota_expiresAt_idx" ON "submission_quota"("expiresAt");

ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_status_check"
  CHECK ("status" IN ('pending', 'publishing', 'approved', 'rejected'));
ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_revision_check" CHECK ("revision" > 0);

COMMIT;
