// ========================================
// 歌詞データインポートスクリプト
// ========================================
// 【セットアップ手順】
// 1. Google Apps Script プロジェクトを作成し、このスクリプトを貼り付ける
// 2. CONFIG を編集
//    - folderId: 歌詞データ(.txt) を置く Drive フォルダ ID
//    - spreadsheetId: 曲一覧スプレッドシートの ID
//    - sheetName: 使うシート名
// 3. スクリプト プロパティに IMPORT_SECRET を設定
//    - 「プロジェクト設定」>「スクリプト プロパティ」>「スクリプト プロパティを追加」から IMPORT_SECRET を登録
// 4. スプレッドシートを準備
//    - 列（順不同）: 曲番, 曲URL, 曲名, アーティスト名, 難易度, updateFlag
//    - 送信したい行の updateFlag に「1」を入れる
// 5. Drive の対象フォルダに歌詞 .txt を配置（ファイル名はスプレッドシートの曲番と対応）
// 6. main() を実行
//    - 初回実行時は Drive/Spreadsheet/外部送信の許可ダイアログを承認
//    - ログに処理結果が出力され、追加・更新時は該当行の updateFlag がクリアされます
// ========================================

const CONFIG = {
  endpoint: 'https://lyric-data-creator.vercel.app/api/import-songs',
  folderId: 'replace-with-folder-id', // 歌詞データ(.txt)  を置く Drive フォルダ ID
  spreadsheetId: 'replace-with-spreadsheet-id', // 曲情報を載せたスプレッドシート ID
  sheetName: '', // 使うシート名（空なら先頭シート）
  noUpdate: true, // true: 既存曲はスキップ / false: 既存曲も更新
  maxSongsPerRequest: 100, // APIへ送る際の1リクエストあたり曲数上限
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

  const songsToImport = []

  sheetInfo.entries.forEach(entry => {
    const song = buildSong(fileMap, entry)
    if (!song) return
    songsToImport.push({ song, updateCell: entry.updateCell })
  })

  if (!songsToImport.length) {
    Logger.log('送信可能な曲がありません')
    return
  }

  const chunks = chunkArray(songsToImport, CONFIG.maxSongsPerRequest || 100)
  Logger.log('送信対象: %s 曲 / リクエスト分割数: %s', songsToImport.length, chunks.length)

  chunks.forEach((chunk, idx) => {
    Logger.log('送信開始 (%s/%s) %s件', idx + 1, chunks.length, chunk.length)
    const payload = {
      noUpdate: CONFIG.noUpdate,
      truncate: false,
      songs: chunk.map(item => item.song),
    }
    const result = importSongsBatch(payload, importSecret)
    const results = result && result.results ? result.results : []

    chunk.forEach((item, itemIdx) => {
      const res = results[itemIdx] || {}
      const status = res.status || 'unknown'
      const title = res.title || item.song.title
      Logger.log('%s / %s / %s', item.song.fileName, title, status)
      const updated = status === 'updated' || status === 'created'

      if (updated && item.updateCell) {
        sheetInfo.sheet.getRange(item.updateCell.row, item.updateCell.col).setValue('')
        Logger.log('%s / %s / スプレッドシート内のupdateFlagをクリア', item.song.fileName, title)
      }
    })
    Logger.log('送信完了 (%s/%s)', idx + 1, chunks.length)
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

  const blob = file.getBlob()
  const txtContent = blob.getDataAsString('UTF-8')
  Logger.log('読み込み完了: %s (%s bytes)', fileName, txtContent.length)

  return {
    fileName,
    title: meta.title,
    youtubeUrl: meta.youtube,
    artist: meta.artist || undefined,
    level: meta.level || undefined,
    txtContent,
  }
}

function chunkArray(array, size) {
  if (!size || size <= 0) return [array]
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
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

function importSongsBatch(payload, importSecret) {
  try {
    const res = postJsonWithRedirect(CONFIG.endpoint, payload, importSecret)
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
