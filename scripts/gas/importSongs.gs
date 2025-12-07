// 実行前に下記を設定してください。
// 1. スクリプト プロパティに IMPORT_SECRET を設定（「プロジェクトの設定」→「スクリプトのプロパティ」）。
// 2. CONFIG.folderId に歌詞データ(.txt) を置く Drive フォルダ ID を設定。
// 3. CONFIG.spreadsheetId と CONFIG.sheetName に曲一覧スプレッドシートの ID／シート名を設定（シート名が空なら先頭シートを使用）。
// 4. 更新対象の曲の updateFlag 列に 1 を設定。
// 5. main を実行。初回のみ Drive／スプレッドシート／外部送信の許可ダイアログが出るので承認。

const CONFIG = {
  endpoint: 'https://lyric-data-creator.vercel.app/api/import-songs',
  folderId: 'replace-with-folder-id', // TXT を置く Drive フォルダ ID
  spreadsheetId: 'replace-with-spreadsheet-id', // 曲メタ情報を載せたスプレッドシート ID
  sheetName: '', // 使うシート名（空なら先頭シート）
  noUpdate: true, // true: 既存曲はスキップ / false: 既存曲も更新
}

const COLUMN_MAP = {
  '曲番': 'file',
  '曲URL': 'youtube',
  '曲名': 'title',
  'アーティスト名': 'artist',
  '難易度': 'level',
  'updateFlag': 'updateFlag',
}

function main() {
  const folder = DriveApp.getFolderById(CONFIG.folderId)
  const sheetInfo = loadSheetData(CONFIG.spreadsheetId, CONFIG.sheetName)
  
  if (!sheetInfo.entries.length) {
    Logger.log('更新対象曲なし（更新対象曲のupdateFlag列に1を設定してください）')
    return
  }

  const importSecret = PropertiesService.getScriptProperties().getProperty('IMPORT_SECRET')
  if (!importSecret) {
    Logger.log('IMPORT_SECRETが未設定です')
    return
  }

  const fileMap = buildFileMap(folder)
  
  sheetInfo.entries.forEach(entry => {
    const song = buildSong(fileMap, entry)
    if (!song) return

    const result = importSong(song, importSecret)
    const status = result && result.status ? result.status : 'unknown'
    const title = result && result.title ? result.title : song.title
    Logger.log('%s / %s / %s', song.fileName, title, status)
    const updated = status === 'updated' || status === 'created'

    if (updated && entry.updateCell) {
      sheetInfo.sheet.getRange(entry.updateCell.row, entry.updateCell.col).setValue('')
      Logger.log('%s / %s / スプレッドシート内のupdateFlagをクリア', song.fileName, title)
    }
  })
}

function buildFileMap(folder) {
  const map = {}
  const files = folder.getFiles()
  
  while (files.hasNext()) {
    const file = files.next()
    const name = file.getName()
    if (name.toLowerCase().endsWith('.txt')) {
      map[name] = file
    }
  }
  return map
}

function buildSong(fileMap, entry) {
  const { meta } = entry
  const fileName = meta.file.endsWith('.txt') ? meta.file : `${meta.file}.txt`
  const file = fileMap[fileName]
  
  if (!file || !meta.youtube || !meta.title) return null

  return {
    fileName,
    title: meta.title,
    youtubeUrl: meta.youtube,
    artist: meta.artist || undefined,
    level: meta.level || undefined,
    txtContent: file.getBlob().getDataAsString('UTF-8'),
  }
}

function loadSheetData(spreadsheetId, sheetName) {
  if (!spreadsheetId) return { entries: [], sheet: null }
  
  const ss = SpreadsheetApp.openById(spreadsheetId)
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0]
  
  if (!sheet) {
    Logger.log('シートが見つかりません: %s', sheetName || '先頭シート')
    return { entries: [], sheet: null }
  }

  const [headers, ...rows] = sheet.getDataRange().getValues()
  const colMap = headers.map(h => COLUMN_MAP[String(h).trim()] || '')
  const updateFlagCol = colMap.indexOf('updateFlag')

  if (updateFlagCol < 0) {
    Logger.log('エラー: updateFlag列が見つかりません')
    return { entries: [], sheet: null }
  }
  
  const entries = rows
    .map((row, idx) => parseRow(row, colMap, idx + 2, updateFlagCol))
    .filter(Boolean)

  return { entries, sheet }
}

function parseRow(row, colMap, rowIndex, updateFlagCol) {
  const meta = {}
  colMap.forEach((key, idx) => {
    if (key) meta[key] = String(row[idx] || '').trim()
  })

  if (!meta.file || (updateFlagCol >= 0 && !meta.updateFlag)) return null

  return {
    meta,
    updateCell: updateFlagCol >= 0 ? { row: rowIndex, col: updateFlagCol + 1 } : null
  }
}

function importSong(song, importSecret) {
  const payload = {
    noUpdate: CONFIG.noUpdate,
    truncate: false,
    songs: [song],
  }

  try {
    const res = postJsonWithRedirect(CONFIG.endpoint, payload, importSecret)
    const statusCode = res.getResponseCode()
    const content = res.getContentText() || ''
    let body

    try {
      body = JSON.parse(content)
    } catch (error) {
      Logger.log('エラー: %s / status=%s / JSON解析失敗: %s / body=%s', song.fileName, statusCode, error.message, content || '(empty)')
      return { status: 'error', title: song.title }
    }

    const result = body && body.results && body.results[0] ? body.results[0] : null
    if (result) {
      const status = result.status || 'unknown'
      return { status, title: result.title || song.title }
    }

    Logger.log('エラー: %s / status=%s / レスポンス形式不正 / body=%s', song.fileName, statusCode, content || '(empty)')
  } catch (error) {
    Logger.log('エラー: %s / %s', song.fileName, error.message)
  }

  return { status: 'error', title: song.title }
}

function postJsonWithRedirect(url, body, importSecret) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
    followRedirects: false,
    headers: { 'x-import-secret': importSecret },
  }
  const res = UrlFetchApp.fetch(url, options)
  const status = res.getResponseCode()
  if ([301, 302, 303, 307, 308].indexOf(status) === -1) return res

  const headers = res.getAllHeaders()
  const location = headers.Location || headers.location
  if (!location) return res

  const followUrl = buildAbsoluteUrl(url, location)
  const followOptions = Object.assign({}, options, { followRedirects: true })
  return UrlFetchApp.fetch(followUrl, followOptions)
}

function buildAbsoluteUrl(baseUrl, location) {
  if (!location) return baseUrl
  if (/^https?:\/\//i.test(location)) return location
  const match = String(baseUrl || '').match(/^(https?:\/\/[^/]+)/i)
  const origin = match ? match[1] : ''
  if (!origin) return location
  if (location.startsWith('/')) return `${origin}${location}`
  return `${origin}/${location}`
}
