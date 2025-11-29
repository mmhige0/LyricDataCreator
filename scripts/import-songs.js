#!/usr/bin/env node
/**
 * Import songs directly into the database from txt exports (+ optional CSV metadata).
 *
 * Usage examples:
 *   node scripts/import-songs.js --dir ./lyric-data --csv ./lyric-data/data.csv
 *   node scripts/import-songs.js --file ./lyric-data/song.txt --youtube https://youtu.be/... --title "My Song"
 *
 * CSV format:
 * file,youtube,title,artist,level
 * sample.txt,https://youtu.be/abc,"Title","Artist","Hard"
 *
 * Notes:
 * - Requires .env with DATABASE_URL set (Postgres想定、Prismaのdatasourceがpostgresqlに統一済み)。
 * - Upserts by title (exact match). Use --no-update to skip existing titles.
 */

const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)
const getArg = (flag) => {
  const idx = args.indexOf(flag)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const dir = getArg("--dir")
const singleFile = getArg("--file")
const csvPath = getArg("--csv")
const defaultYoutube = getArg("--youtube")
const defaultArtist = getArg("--artist")
const defaultLevel = getArg("--level")
const singleTitle = getArg("--title")
const allowUpdate = !hasFlag("--no-update")
const truncateAll = hasFlag("--truncate")

if (!dir && !singleFile) {
  console.error("Error: --dir または --file を指定してください。")
  process.exit(1)
}

const parseCsvLine = (line) => {
  const fields = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') {
      // Escaped quote
      current += '"'
      i++
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === "," && !inQuotes) {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

const parseCsv = (text) => {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return {}
  const [header, ...rows] = lines
  const cols = parseCsvLine(header)
  const map = {}
  for (const line of rows) {
    const parts = parseCsvLine(line)
    const row = {}
    cols.forEach((col, i) => {
      const value = parts[i] ?? ""
      row[col] = value
    })
    if (row.file) map[row.file] = row
  }
  return map
}

const loadCsvMap = () => {
  if (!csvPath) return {}
  if (!fs.existsSync(csvPath)) {
    console.warn(`CSV not found: ${csvPath}`)
    return {}
  }
  try {
    const text = fs.readFileSync(csvPath, "utf-8")
    return parseCsv(text)
  } catch (error) {
    console.warn(`Failed to read CSV: ${error.message}`)
    return {}
  }
}

const parseTxtToScoreEntries = (content) => {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error("行数が不足しています")
  const entries = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split("/")
    if (parts.length !== 5) throw new Error(`${i + 1}行目: フォーマットが正しくありません`)
    const ts = Number.parseFloat(parts[4])
    if (Number.isNaN(ts)) throw new Error(`${i + 1}行目: タイムスタンプが正しくありません`)
    if (ts === 999.9) continue
    const lyrics = parts.slice(0, 4).map((p) => (p === "!" ? "" : p))
    entries.push({ id: `import_${i}_${Date.now()}`, timestamp: ts, lyrics })
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

const titleFromFilename = (filePath) => {
  const base = path.basename(filePath, path.extname(filePath))
  return base.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, "") || base
}

const gatherFiles = () => {
  if (singleFile) return [singleFile]
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => path.join(dir, e.name))
}

const resolveMetadata = (filePath, csvMap) => {
  const base = path.basename(filePath)
  const meta = csvMap[base] || {}
  return {
    title: meta.title || singleTitle || titleFromFilename(filePath),
    youtubeUrl: meta.youtube || defaultYoutube || "",
    artist: meta.artist || defaultArtist || undefined,
    level: meta.level || defaultLevel || undefined,
  }
}

const upsertSong = async (data) => {
  const existing = await prisma.song.findFirst({ where: { title: data.title } })
  if (existing && allowUpdate) {
    return prisma.song.update({
      where: { id: existing.id },
      data: {
        artist: data.artist ?? null,
        youtubeUrl: data.youtubeUrl,
        level: data.level ?? null,
        scoreEntries: JSON.stringify(data.scoreEntries),
      },
    })
  }
  if (existing && !allowUpdate) {
    return existing
  }
  return prisma.song.create({
    data: {
      title: data.title,
      artist: data.artist ?? null,
      youtubeUrl: data.youtubeUrl,
      level: data.level ?? null,
      scoreEntries: JSON.stringify(data.scoreEntries),
    },
  })
}

const main = async () => {
  try {
    if (truncateAll) {
      console.warn("Truncating all songs...")
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "Song" RESTART IDENTITY CASCADE;')
    }

    const csvMap = loadCsvMap()
    const files = gatherFiles()
    if (!files.length) {
      console.error("対象となる .txt ファイルがありません。")
      process.exit(1)
    }
    console.log(`Found ${files.length} file(s). Importing to DB`)

    for (const filePath of files) {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        console.warn(`Skip (empty or missing): ${filePath}`)
        continue
      }

      const meta = resolveMetadata(filePath, csvMap)
      if (!meta.youtubeUrl) {
        console.warn(`Skip (no youtubeUrl): ${filePath}`)
        continue
      }

      const content = fs.readFileSync(filePath, "utf-8")
      let scoreEntries
      try {
        scoreEntries = parseTxtToScoreEntries(content)
      } catch (error) {
        console.warn(`Skip (parse error): ${filePath} -> ${error.message}`)
        continue
      }
      if (!scoreEntries.length) {
        console.warn(`Skip (no entries): ${filePath}`)
        continue
      }

      const song = await upsertSong({
        title: meta.title,
        artist: meta.artist,
        youtubeUrl: meta.youtubeUrl,
        level: meta.level,
        scoreEntries,
      })
      console.log(`OK: ${filePath} -> id=${song.id} title=${song.title}`)
    }
  } catch (error) {
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
