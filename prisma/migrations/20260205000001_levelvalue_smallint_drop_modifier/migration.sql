-- Recompute levelValue from level: (numeric part * 3) plus +/- 1 for +/- modifiers
UPDATE "Song"
SET "levelValue" = CASE
  WHEN "level" ~ '^[0-9]+\\+$' THEN (regexp_replace("level", '[^0-9]', '', 'g')::int * 3) + 1
  WHEN "level" ~ '^[0-9]+-$' THEN (regexp_replace("level", '[^0-9]', '', 'g')::int * 3) - 1
  WHEN "level" ~ '^[0-9]+$' THEN (regexp_replace("level", '[^0-9]', '', 'g')::int * 3)
  ELSE NULL
END;

-- Change levelValue to SMALLINT
ALTER TABLE "Song" ALTER COLUMN "levelValue" TYPE SMALLINT USING "levelValue"::SMALLINT;

-- Drop legacy modifier column
ALTER TABLE "Song" DROP COLUMN "levelModifier";

-- Rebuild index for ordering by level
CREATE INDEX "Song_levelValue_idx" ON "Song" ("levelValue" NULLS LAST);
