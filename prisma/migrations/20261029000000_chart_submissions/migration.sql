-- AlterTable
ALTER TABLE "song" ADD COLUMN     "creatorName" TEXT,
ADD COLUMN     "gameSongId" TEXT,
ADD COLUMN     "scoreTxt" TEXT;

-- CreateTable
CREATE TABLE "chart_submission" (
    "id" UUID NOT NULL,
    "editTokenHash" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "level" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "txtContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "gameSongId" TEXT,
    "publishedSongId" INTEGER,
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
CREATE UNIQUE INDEX "chart_submission_gameSongId_key" ON "chart_submission"("gameSongId");

-- CreateIndex
CREATE UNIQUE INDEX "chart_submission_publishedSongId_key" ON "chart_submission"("publishedSongId");

-- CreateIndex
CREATE INDEX "chart_submission_status_updatedAt_idx" ON "chart_submission"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "submission_quota_expiresAt_idx" ON "submission_quota"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "song_gameSongId_key" ON "song"("gameSongId");

-- AddForeignKey
ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_publishedSongId_fkey" FOREIGN KEY ("publishedSongId") REFERENCES "song"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_status_check"
  CHECK ("status" IN ('pending', 'publishing', 'approved', 'rejected'));
ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_revision_check" CHECK ("revision" > 0);
