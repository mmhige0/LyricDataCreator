-- Add normalized level columns for sortable ordering
ALTER TABLE "Song" ADD COLUMN "levelValue" DOUBLE PRECISION;
ALTER TABLE "Song" ADD COLUMN "levelModifier" INTEGER;

-- Index to speed up ordering by level
CREATE INDEX "Song_levelValue_levelModifier_idx" ON "Song" ("levelValue" NULLS LAST, "levelModifier" NULLS LAST);
