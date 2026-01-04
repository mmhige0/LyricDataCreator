-- RenameTable
ALTER TABLE "Song" RENAME TO "song";

-- RenamePrimaryKey
ALTER TABLE "song" RENAME CONSTRAINT "Song_pkey" TO "song_pkey";

-- RenameIndex
ALTER INDEX "Song_title_idx" RENAME TO "song_title_idx";
ALTER INDEX "Song_artist_idx" RENAME TO "song_artist_idx";
ALTER INDEX "Song_levelValue_idx" RENAME TO "song_levelValue_idx";
