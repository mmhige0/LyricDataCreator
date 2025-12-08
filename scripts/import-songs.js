#!/usr/bin/env node
/**
 * Import songs via the /api/import-songs endpoint from txt exports (+ optional CSV metadata).
 *
 * Usage examples:
 *   node scripts/import-songs.js --dir ./lyric-data/lyric-file --csv ./lyric-data/data.csv
 *   node scripts/import-songs.js --file ./lyric-data/lyric-file/song.txt --youtube https://youtu.be/... --title "My Song"
 *   node scripts/import-songs.js --dir ./lyric-data/lyric-file --endpoint http://localhost:3000/api/import-songs
 *
 * CSV format:
 * file,youtube,title,artist,level
 * sample.txt,https://youtu.be/abc,"Title","Artist","Hard"
 *
 * Notes:
 * - Requires IMPORT_SECRET (env or --secret) that matches the API route config.
 * - Endpoint defaults to http://localhost:3000/api/import-songs (override with env IMPORT_SONGS_ENDPOINT or --endpoint)。
 * - Upserts by title (exact match) on the API side. Use --no-update to skip existing titles.
 */

const fs = require("fs")
const path = require("path")

const args = process.argv.slice(2)
const hasFlag = (flag) => args.includes(flag)
const getArg = (flag) => {
  const idx = args.indexOf(flag)
  if (idx === -1) return undefined
  return args[idx + 1]
}
const ensureTxtExtension = (filePath) => {
  if (!filePath) return filePath
  return path.extname(filePath) ? filePath : `${filePath}.txt`
}

const dir = getArg("--dir")
const singleFile = ensureTxtExtension(getArg("--file"))
const csvPath = getArg("--csv")
const defaultYoutube = getArg("--youtube")
const defaultArtist = getArg("--artist")
const defaultLevel = getArg("--level")
const singleTitle = getArg("--title")
const allowUpdate = !hasFlag("--no-update")
const truncateAll = hasFlag("--truncate")
const endpoint =
  getArg("--endpoint") ||
  process.env.IMPORT_SONGS_ENDPOINT ||
  process.env.IMPORT_ENDPOINT ||
  "http://localhost:3000/api/import-songs"
const importSecret = getArg("--secret") || process.env.IMPORT_SECRET

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
    if (row.file) {
      const key = ensureTxtExtension(row.file)
      map[key] = row
    }
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
  const base = ensureTxtExtension(path.basename(filePath))
  const meta = csvMap[base] || {}
  return {
    title: meta.title || singleTitle || titleFromFilename(filePath),
    youtubeUrl: meta.youtube || defaultYoutube || "",
    artist: meta.artist || defaultArtist || undefined,
    level: meta.level || defaultLevel || undefined,
  }
}

const buildSongPayload = (filePath, csvMap) => {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    console.warn(`Skip (empty or missing): ${filePath}`)
    return null
  }

  const meta = resolveMetadata(filePath, csvMap)
  if (!meta.youtubeUrl) {
    console.warn(`Skip (no youtubeUrl): ${filePath}`)
    return null
  }

  const txtContent = fs.readFileSync(filePath, "utf-8")
  if (!txtContent.trim()) {
    console.warn(`Skip (no content): ${filePath}`)
    return null
  }

  return {
    filePath,
    payload: {
      title: meta.title,
      youtubeUrl: meta.youtubeUrl,
      artist: meta.artist,
      level: meta.level,
      txtContent,
    },
  }
}

const postToApi = async (body) => {
  if (!importSecret) {
    console.error("Error: IMPORT_SECRET is required. Pass via --secret or set env IMPORT_SECRET")
    process.exit(1)
  }

  const headers = {
    "Content-Type": "application/json",
    "x-import-secret": importSecret,
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`API error: status=${res.status} body=${text || "(empty)"}`)
  }

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Failed to parse API response JSON: ${error.message}`)
  }
}

const main = async () => {
  try {
    const csvMap = loadCsvMap()
    const files = gatherFiles()
    if (!files.length) {
      console.error("対象となる .txt ファイルがありません。")
      process.exit(1)
    }

    const songs = []
    const sources = []

    for (const filePath of files) {
      const song = buildSongPayload(filePath, csvMap)
      if (!song) continue
      songs.push(song.payload)
      sources.push({ filePath, title: song.payload.title })
    }

    if (!songs.length) {
      console.warn("送信する曲がありませんでした")
      return
    }

    console.log(
      `Found ${songs.length} song(s). Sending to API ${endpoint} (noUpdate=${!allowUpdate}, truncate=${truncateAll})`,
    )

    const result = await postToApi({
      songs,
      noUpdate: !allowUpdate,
      truncate: truncateAll,
    })

    const apiResults = Array.isArray(result?.results) ? result.results : []
    let songIdx = 0
    apiResults.forEach((res) => {
      if (res.status === "truncated") {
        console.log("Truncated all songs before import")
        return
      }
      const source = sources[songIdx] || {}
      songIdx += 1
      const title = res.title || source.title || "(unknown title)"
      const filePath = source.filePath || "(unknown file)"
      const status = res.status || "unknown"
      const message = res.message ? ` (${res.message})` : ""
      const id = res.id ? ` id=${res.id}` : ""
      console.log(`${status}: ${filePath} -> ${title}${id}${message}`)
    })
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main()
