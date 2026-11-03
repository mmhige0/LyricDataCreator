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
ALTER TABLE "song" ADD COLUMN "creatorName" TEXT;

-- BEGIN SCORE TXT CONVERSION
ALTER TABLE song ADD COLUMN IF NOT EXISTS "scoreTxt" TEXT;

-- Fail the transaction on malformed legacy pages instead of discarding their data.
CREATE TEMP TABLE legacy_score_pages (
  song_no TEXT NOT NULL,
  position BIGINT NOT NULL,
  timestamp NUMERIC NOT NULL CHECK (timestamp >= 0 AND timestamp <> 999.9 AND timestamp < 1e12),
  lyrics JSONB NOT NULL CHECK (
    jsonb_typeof(lyrics) = 'array' AND jsonb_array_length(lyrics) = 4
    AND jsonb_typeof(lyrics->0) = 'string' AND jsonb_typeof(lyrics->1) = 'string'
    AND jsonb_typeof(lyrics->2) = 'string' AND jsonb_typeof(lyrics->3) = 'string'
  ),
  decorations JSONB CHECK (decorations IS NULL OR (
    jsonb_typeof(decorations) = 'array' AND jsonb_array_length(decorations) = 4
    AND jsonb_typeof(decorations->0) = 'boolean' AND jsonb_typeof(decorations->1) = 'boolean'
    AND jsonb_typeof(decorations->2) = 'boolean' AND jsonb_typeof(decorations->3) = 'boolean'
  )),
  aligns JSONB CHECK (aligns IS NULL OR (
    jsonb_typeof(aligns) = 'array' AND jsonb_array_length(aligns) = 4
    AND aligns->>0 IN ('l', 'c', 'r') AND aligns->>1 IN ('l', 'c', 'r')
    AND aligns->>2 IN ('l', 'c', 'r') AND aligns->>3 IN ('l', 'c', 'r')
  ))
) ON COMMIT DROP;

INSERT INTO legacy_score_pages
SELECT s."gameSongId", p.ordinality, (p.value->>'timestamp')::numeric,
       p.value->'lyrics', p.value->'decorations', p.value->'decorationAligns'
FROM song s CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN NULLIF(btrim(s."scoreTxt"), '') IS NULL THEN s."scoreEntries"::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS p(value, ordinality);

WITH fields AS (
  SELECT song_no, position, timestamp, i,
    CASE WHEN decorations->>i = 'true'
      THEN '![' || COALESCE(aligns->>i, 'l') || ']' ||
        replace(replace(lyrics->>i, chr(92), chr(92)||chr(92)), '/', chr(92)||'/')
      ELSE COALESCE(NULLIF(replace(replace(lyrics->>i, chr(92), chr(92)||chr(92)), '/', chr(92)||'/'), ''), '!')
    END AS field
  FROM legacy_score_pages CROSS JOIN generate_series(0, 3) AS i
), pages AS (
  SELECT song_no, position, timestamp,
    string_agg(field, '/' ORDER BY i) || '/' || round(timestamp, 2)::text AS line
  FROM fields GROUP BY song_no, position, timestamp
), charts AS (
  SELECT song_no, round(max(timestamp) + 5, 1)::text || chr(10) ||
    string_agg(line, chr(10) ORDER BY timestamp, position) || chr(10) || '!/!/!/!/999.9' || chr(10) AS txt
  FROM pages GROUP BY song_no
)
UPDATE song SET "scoreTxt" = COALESCE(charts.txt, '5.0' || chr(10) || '!/!/!/!/999.9' || chr(10))
FROM (SELECT s."gameSongId", c.txt FROM song s LEFT JOIN charts c ON c.song_no = s."gameSongId") charts
WHERE song."gameSongId" = charts."gameSongId" AND NULLIF(btrim(song."scoreTxt"), '') IS NULL;

ALTER TABLE song ALTER COLUMN "scoreTxt" SET NOT NULL;
ALTER TABLE song DROP COLUMN "scoreEntries";
-- END SCORE TXT CONVERSION

-- CreateTable
CREATE TABLE "chart_submission" (
    "id" UUID NOT NULL,
    "editTokenHash" TEXT NOT NULL,
    "level" TEXT DEFAULT '-',
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

-- CreateIndex
CREATE INDEX "chart_submission_gameSongId_idx" ON "chart_submission"("gameSongId");

-- CreateIndex
CREATE INDEX "chart_submission_status_updatedAt_idx" ON "chart_submission"("status", "updatedAt");

ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_status_check"
  CHECK ("status" IN ('pending', 'publishing', 'approved', 'rejected'));
ALTER TABLE "chart_submission" ADD CONSTRAINT "chart_submission_revision_check" CHECK ("revision" > 0);

COMMIT;
