// ========================================
// 歌詞データインポートスクリプト
// ========================================
// スプレッドシートと Drive フォルダから歌詞データを API にインポート
// セットアップ手順は common.gs を参照
// ========================================

const IMPORT_ENDPOINT = '/api/import-songs'
const LAST_SCAN_AT_KEY = 'LAST_SCAN_AT'

const IMPORT_COLUMN_MAP = {
  '曲番': 'file',
  '曲URL': 'youtube',
  '曲名': 'title',
  'アーティスト名': 'artist',
  '難易度': 'level',
}

function main() {
  const folder = DriveApp.getFolderById(CONFIG.folderId)
  const sheetInfo = loadImportSheetData(CONFIG.spreadsheetId, CONFIG.sheetName)
  const lastScanAt = getLastScanAt()

  if (!sheetInfo.entries.length) {
    Logger.log('有効な行がありません（曲番が空、またはシートが空です）')
    return
  }

  const importSecret = getImportSecret()
  if (!importSecret) {
    Logger.log('IMPORT_SECRETが未設定です')
    return
  }

  const fileMap = buildFileMap(folder)
  const latestFileUpdatedAt = getLatestUpdatedAt(fileMap)

  const songsToImport = []

  sheetInfo.entries.forEach(entry => {
    const result = buildSongResult(fileMap, entry, lastScanAt)
    if (!result.song) {
      return
    }
    songsToImport.push({ song: result.song })
  })

  if (!songsToImport.length) {
    Logger.log('送信可能な曲がありません')
    setLastScanAt(latestFileUpdatedAt)
    return
  }

  const chunks = chunkArray(songsToImport, CONFIG.maxSongsPerImport || 100)
  Logger.log('送信対象: %s 曲 / リクエスト分割数: %s', songsToImport.length, chunks.length)

  const endpoint = CONFIG.baseUrl + IMPORT_ENDPOINT

  chunks.forEach((chunk, idx) => {
    Logger.log('送信開始 (%s/%s) %s件', idx + 1, chunks.length, chunk.length)
    const payload = {
      noUpdate: CONFIG.noUpdate,
      truncate: false,
      songs: chunk.map(item => item.song),
    }
    const result = importSongsBatch(endpoint, payload, importSecret)
    const results = result && result.results ? result.results : []

    chunk.forEach((item, itemIdx) => {
      const res = results[itemIdx] || {}
      const status = res.status || 'unknown'
      const title = res.title || item.song.title
      Logger.log('%s / %s / %s', item.song.fileName, title, status)
      const updated = status === 'updated' || status === 'created'

      if (updated) {
        Logger.log('%s / %s / 送信成功', item.song.fileName, title)
      }
    })
    Logger.log('送信完了 (%s/%s)', idx + 1, chunks.length)
  })

  setLastScanAt(latestFileUpdatedAt)

  // インポート後に全曲の難易度を更新
  Logger.log('--- 難易度更新を開始 ---')
  updateAllLevels(CONFIG.spreadsheetId, CONFIG.sheetName)
}

function buildFileMap(folder) {
  const map = {}
  const files = folder.getFiles()

  while (files.hasNext()) {
    const file = files.next()
    const name = file.getName()
    if (name.toLowerCase().endsWith('.txt')) {
      map[name] = {
        file,
        updatedAt: file.getLastUpdated().getTime(),
      }
    }
  }
  return map
}

function getLastScanAt() {
  const raw = PropertiesService.getScriptProperties().getProperty(LAST_SCAN_AT_KEY)
  if (!raw) return 0
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? 0 : parsed
}

function setLastScanAt(timestamp) {
  if (!timestamp || timestamp <= 0) return
  PropertiesService.getScriptProperties().setProperty(
    LAST_SCAN_AT_KEY,
    new Date(timestamp).toISOString(),
  )
}

function getLatestUpdatedAt(fileMap) {
  let latest = 0
  Object.keys(fileMap).forEach(name => {
    const updatedAt = fileMap[name].updatedAt || 0
    if (updatedAt > latest) latest = updatedAt
  })
  return latest
}

function buildSongResult(fileMap, entry, lastScanAt) {
  const { meta } = entry
  const fileName = meta.file.endsWith('.txt') ? meta.file : `${meta.file}.txt`
  const fileInfo = fileMap[fileName]

  if (!fileInfo) return { song: null, reason: 'missingFile' }
  if (!meta.youtube || !meta.title) return { song: null, reason: 'missingRequired' }
  if (lastScanAt && fileInfo.updatedAt <= lastScanAt) {
    return { song: null, reason: 'notUpdated' }
  }

  const blob = fileInfo.file.getBlob()
  const txtContent = blob.getDataAsString('UTF-8')
  Logger.log('読み込み完了: %s (%s bytes)', fileName, txtContent.length)

  return {
    reason: null,
    song: {
      fileName,
      title: meta.title,
      youtubeUrl: meta.youtube,
      artist: meta.artist || undefined,
      level: meta.level || undefined,
      txtContent,
    },
  }
}

function loadImportSheetData(spreadsheetId, sheetName) {
  if (!spreadsheetId) return { entries: [], sheet: null }

  const ss = SpreadsheetApp.openById(spreadsheetId)
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0]

  if (!sheet) {
    Logger.log('シートが見つかりません: %s', sheetName || '先頭シート')
    return { entries: [], sheet: null }
  }

  const [headers, ...rows] = sheet.getDataRange().getValues()
  const colMap = headers.map(h => IMPORT_COLUMN_MAP[String(h).trim()] || '')

  const entries = rows
    .map((row, idx) => parseImportRow(row, colMap, idx + 2))
    .filter(Boolean)

  return { entries, sheet }
}

function parseImportRow(row, colMap, rowIndex) {
  const meta = {}
  colMap.forEach((key, idx) => {
    if (key) meta[key] = String(row[idx] || '').trim()
  })

  if (!meta.file) return null

  return {
    meta,
  }
}

function importSongsBatch(endpoint, payload, importSecret) {
  try {
    const res = fetchJsonWithRedirect('post', endpoint, payload, importSecret)
    const statusCode = res.getResponseCode()
    const content = res.getContentText() || ''
    let body

    try {
      body = JSON.parse(content)
    } catch (error) {
      Logger.log('エラー: status=%s / JSON解析失敗: %s / body=%s', statusCode, error.message, content || '(empty)')
      return { results: [] }
    }

    if (body && body.results && Array.isArray(body.results)) {
      return { results: body.results }
    }

    Logger.log('エラー: status=%s / レスポンス形式不正 / body=%s', statusCode, content || '(empty)')
  } catch (error) {
    Logger.log('エラー: %s', error.message)
  }

  return { results: [] }
}
