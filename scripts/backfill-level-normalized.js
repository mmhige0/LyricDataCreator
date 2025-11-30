#!/usr/bin/env node
/**
 * Backfill levelValue / levelModifier from existing Song.level strings.
 * Usage: node scripts/backfill-level-normalized.js
 * Requires DATABASE_URL to be set.
 */

const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const parseLevelValue = (value) => {
  const match = value?.trim().match(/^([0-9]+)([+-])?$/)
  if (!match) return null
  const base = Number.parseInt(match[1], 10)
  const modifier = match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0
  // Normalize: base level (e.g. 10) is multiplied by 3, with +/- adjusting by 1.
  return base * 3 + modifier
}

async function main() {
  const songs = await prisma.song.findMany({
    select: { id: true, level: true },
  })

  let updated = 0
  for (const song of songs) {
    const levelValue = parseLevelValue(song.level)
    await prisma.song.update({
      where: { id: song.id },
      data: {
        levelValue,
      },
    })
    updated += 1
  }

  console.log(`Updated ${updated} songs.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
