#!/usr/bin/env node
/**
 * Backfill levelValue / levelModifier from existing Song.level strings.
 * Usage: node scripts/backfill-level-normalized.js
 * Requires DATABASE_URL to be set.
 */

const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const parseLevel = (value) => {
  const match = value?.trim().match(/^([0-9]+(?:\.[0-9]+)?)([+-])?$/)
  if (!match) return { levelValue: null, levelModifier: null }
  const levelValue = Number.parseFloat(match[1])
  const levelModifier = match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0
  return { levelValue, levelModifier }
}

async function main() {
  const songs = await prisma.song.findMany({
    select: { id: true, level: true },
  })

  let updated = 0
  for (const song of songs) {
    const parsed = parseLevel(song.level)
    await prisma.song.update({
      where: { id: song.id },
      data: {
        levelValue: parsed.levelValue,
        levelModifier: parsed.levelModifier,
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
