-- Allow multiple pending proposals for one public song.
DROP INDEX "chart_submission_gameSongId_key";
DROP INDEX "chart_submission_publishedSongId_key";
CREATE INDEX "chart_submission_gameSongId_idx" ON "chart_submission"("gameSongId");
CREATE INDEX "chart_submission_publishedSongId_idx" ON "chart_submission"("publishedSongId");
