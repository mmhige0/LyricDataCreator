// ========================================
// 難易度一括更新スクリプト
// ========================================
// importSongs.gs と同じプロジェクトで使用する場合:
//   - importSongs.gs の main() 実行時に自動で難易度更新が呼ばれる
//   - スプレッドシートID は importSongs.gs の CONFIG から取得
//
// 単独で使用する場合:
//   - updateAllLevels(spreadsheetId, sheetName) を直接呼び出す
//   - スプレッドシートには列（順不同）: ID, 曲名, 難易度 が必要
//   - スクリプト プロパティに IMPORT_SECRET を設定
// ========================================

const UPDATE_LEVELS_CONFIG = {
  endpoint: 'https://lyric-data-creator.vercel.app/api/songs',
  maxSongsPerRequest: 100, // APIへ送る際の1リクエストあたり曲数上限
}

const UPDATE_LEVELS_COLUMN_MAP = {
  'ID': 'id',
  '曲名': 'title',
  '難易度': 'level',
}

/**
 * 全曲の難易度を一括更新する
 * importSongs.gs から呼び出される、または手動でメニューから実行
 * @param {string} spreadsheetId - スプレッドシートID（省略時は importSongs の CONFIG を使用）
 * @param {string} sheetName - シート名（省略時は先頭シート）
 */
function updateAllLevels(spreadsheetId, sheetName) {
  const ssId = spreadsheetId || (typeof CONFIG !== 'undefined' ? CONFIG.spreadsheetId : '')
  const sheet = sheetName || ''

  if (!ssId) {
    Logger.log('スプレッドシートIDが指定されていません')
    return
  }

  const sheetInfo = loadSheetDataForLevels(ssId, sheet)

  if (!sheetInfo.entries.length) {
    Logger.log('難易度更新: 有効な行がありません（IDが空、またはシートが空です）')
    return
  }

  const importSecret = PropertiesService.getScriptProperties().getProperty('IMPORT_SECRET')
  if (!importSecret) {
    Logger.log('IMPORT_SECRETが未設定です')
    return
  }

  const songsToUpdate = sheetInfo.entries
    .filter(entry => entry.meta.id && entry.meta.level)
    .map(entry => ({
      id: Number(entry.meta.id),
      level: entry.meta.level,
      rowIndex: entry.rowIndex,
    }))
    .filter(item => Number.isInteger(item.id))

  if (!songsToUpdate.length) {
    Logger.log('難易度更新: 更新対象の曲がありません')
    return
  }

  const chunks = chunkArray(songsToUpdate, UPDATE_LEVELS_CONFIG.maxSongsPerRequest || 100)
  Logger.log('更新対象: %s 曲 / リクエスト分割数: %s', songsToUpdate.length, chunks.length)

  let totalUpdated = 0
  let totalErrors = 0

  chunks.forEach((chunk, idx) => {
    Logger.log('送信開始 (%s/%s) %s件', idx + 1, chunks.length, chunk.length)
    const payload = {
      songs: chunk.map(item => ({ id: item.id, level: item.level })),
    }
    const result = updateLevelsBatch(payload, importSecret)

    const updated = result.updated || []
    const errors = result.errors || []

    updated.forEach(item => {
      Logger.log('更新成功: ID=%s / %s / level=%s', item.id, item.title, item.level)
    })

    errors.forEach(item => {
      Logger.log('エラー: ID=%s / %s', item.id, item.error)
    })

    totalUpdated += updated.length
    totalErrors += errors.length
    Logger.log('送信完了 (%s/%s)', idx + 1, chunks.length)
  })

  Logger.log('完了: %s件更新, %s件エラー', totalUpdated, totalErrors)
}

function chunkArray(array, size) {
  if (!size || size <= 0) return [array]
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

function loadSheetDataForLevels(spreadsheetId, sheetName) {
  if (!spreadsheetId) return { entries: [], sheet: null }

  const ss = SpreadsheetApp.openById(spreadsheetId)
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0]

  if (!sheet) {
    Logger.log('シートが見つかりません: %s', sheetName || '先頭シート')
    return { entries: [], sheet: null }
  }

  const [headers, ...rows] = sheet.getDataRange().getValues()
  const colMap = headers.map(h => UPDATE_LEVELS_COLUMN_MAP[String(h).trim()] || '')

  const entries = rows
    .map((row, idx) => parseRowForLevels(row, colMap, idx + 2))
    .filter(Boolean)

  return { entries, sheet }
}

function parseRowForLevels(row, colMap, rowIndex) {
  const meta = {}
  colMap.forEach((key, idx) => {
    if (key) meta[key] = String(row[idx] || '').trim()
  })

  if (!meta.id) return null

  return {
    meta,
    rowIndex,
  }
}

function updateLevelsBatch(payload, importSecret) {
  try {
    const res = patchJsonWithRedirect(UPDATE_LEVELS_CONFIG.endpoint, payload, importSecret)
    const statusCode = res.getResponseCode()
    const content = res.getContentText() || ''
    let body

    try {
      body = JSON.parse(content)
    } catch (error) {
      Logger.log('エラー: status=%s / JSON解析失敗: %s / body=%s', statusCode, error.message, content || '(empty)')
      return { updated: [], errors: [] }
    }

    if (statusCode === 401) {
      Logger.log('エラー: 認証失敗 (IMPORT_SECRETを確認してください)')
      return { updated: [], errors: [] }
    }

    if (body && Array.isArray(body.updated) && Array.isArray(body.errors)) {
      return { updated: body.updated, errors: body.errors }
    }

    Logger.log('エラー: status=%s / レスポンス形式不正 / body=%s', statusCode, content || '(empty)')
  } catch (error) {
    Logger.log('エラー: %s', error.message)
  }

  return { updated: [], errors: [] }
}

function patchJsonWithRedirect(url, body, importSecret) {
  const options = {
    method: 'patch',
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('難易度更新')
    .addItem('全行を更新', 'updateAllLevels')
    .addToUi()
}
