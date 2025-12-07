// Fill these before running.
const CONFIG = {
  endpoint: 'https://your-domain.com/api/import-songs',
  importSecret: 'replace-with-secret',
  folderId: 'replace-with-folder-id', // Drive folder containing TXT and CSV
  csvFileName: 'data.csv',
  noUpdate: true, // true => skip updates for existing titles
  truncate: false, // true => truncate songs before importing
}

function main() {
  const folder = DriveApp.getFolderById(CONFIG.folderId)
  const csvMap = loadCsvMap(folder, CONFIG.csvFileName)
  const songs = collectTxtSongs(folder, csvMap)

  if (!songs.length) {
    Logger.log('No songs to send')
    return
  }

  const payload = {
    noUpdate: CONFIG.noUpdate,
    truncate: CONFIG.truncate,
    songs,
  }

  const res = UrlFetchApp.fetch(CONFIG.endpoint, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-import-secret': CONFIG.importSecret,
    },
    payload: JSON.stringify(payload),
  })

  Logger.log('Status: %s', res.getResponseCode())
  Logger.log(res.getContentText())
}

function collectTxtSongs(folder, csvMap) {
  const songs = []
  const files = folder.getFiles()
  while (files.hasNext()) {
    const file = files.next()
    const name = file.getName()
    if (!name.toLowerCase().endsWith('.txt')) continue

    const baseName = ensureTxtExtension(name)
    const meta = csvMap[baseName] || {}
    const youtubeUrl = (meta.youtube || '').trim()
    if (!youtubeUrl) {
      Logger.log('Skip (no youtube): %s', name)
      continue
    }

    const song = {
      title: (meta.title || titleFromFilename(name)).trim(),
      youtubeUrl,
      artist: (meta.artist || '').trim() || undefined,
      level: (meta.level || '').trim() || undefined,
      txtContent: file.getBlob().getDataAsString('UTF-8'),
    }
    songs.push(song)
  }
  return songs
}

function loadCsvMap(folder, csvName) {
  const iterator = folder.getFilesByName(csvName)
  if (!iterator.hasNext()) return {}

  const file = iterator.next()
  const text = file.getBlob().getDataAsString('UTF-8')
  return parseCsv(text)
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return {}
  const [header, ...rows] = lines
  const cols = parseCsvLine(header)
  const map = {}
  rows.forEach((line) => {
    const parts = parseCsvLine(line)
    const row = {}
    cols.forEach((col, i) => {
      row[col] = parts[i] || ''
    })
    if (row.file) {
      const key = ensureTxtExtension(row.file)
      map[key] = row
    }
  })
  return map
}

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"') {
      current += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((f) => f.trim())
}

function ensureTxtExtension(filePath) {
  if (!filePath) return filePath
  return filePath.toLowerCase().endsWith('.txt') ? filePath : `${filePath}.txt`
}

function titleFromFilename(name) {
  const base = name.replace(/\.txt$/i, '')
  return base.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '') || base
}
