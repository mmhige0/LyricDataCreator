// ========================================
// 難易度一括更新スクリプト
// ========================================
// common.gs と同じプロジェクトで使用
// importSongs.gs の main() 実行時に自動で難易度更新が呼ばれる
// 単独実行: updateAllLevels() をメニューから実行
// ========================================

const LEVELS_ENDPOINT = '/api/songs'

const LEVELS_COLUMN_MAP = {
  '曲番': 'id',
  '曲名': 'title',
  '難易度': 'level',
}

// 有効なレベルフォーマット: 数字 + オプションで+/- (例: "1", "5+", "3-")
const LEVEL_FORMAT_REGEX = /^[0-9]+[+-]?$/

function isValidLevelFormat(level) {
  return typeof level === 'string' && LEVEL_FORMAT_REGEX.test(level.trim())
}

/**
 * 全曲の難易度を一括更新する
 * importSongs.gs から呼び出される、または手動でメニューから実行
 * @param {string} spreadsheetId - スプレッドシートID（省略時は CONFIG を使用）
 * @param {string} sheetName - シート名（省略時は CONFIG を使用）
 */
function updateAllLevels(spreadsheetId, sheetName) {
  const ssId = spreadsheetId || CONFIG.spreadsheetId
  const sheet = sheetName || CONFIG.sheetName || ''

  if (!ssId) {
    Logger.log('スプレッドシートIDが指定されていません')
    return
  }

  const sheetInfo = loadLevelsSheetData(ssId, sheet)

  if (!sheetInfo.entries.length) {
    Logger.log('難易度更新: 有効な行がありません（IDが空、またはシートが空です）')
    return
  }

  const importSecret = getImportSecret()
  if (!importSecret) {
    Logger.log('IMPORT_SECRETが未設定です')
    return
  }

  const entriesWithIdAndLevel = sheetInfo.entries.filter(entry => entry.meta.id && entry.meta.level)

  // 無効なレベルフォーマットの件数をログ出力
  const invalidCount = entriesWithIdAndLevel.filter(entry => !isValidLevelFormat(entry.meta.level)).length
  if (invalidCount > 0) {
    Logger.log('無効なレベルフォーマット（スキップ）: %s件', invalidCount)
  }

  const songsToUpdate = entriesWithIdAndLevel
    .filter(entry => isValidLevelFormat(entry.meta.level))
    .map(entry => ({
      id: Number(entry.meta.id),
      level: entry.meta.level.trim(),
      rowIndex: entry.rowIndex,
    }))
    .filter(item => Number.isInteger(item.id))

  if (!songsToUpdate.length) {
    Logger.log('難易度更新: 更新対象の曲がありません')
    return
  }

  const chunks = chunkArray(songsToUpdate, CONFIG.maxSongsPerLevelUpdate || 1000)
  Logger.log('更新対象: %s 曲 / リクエスト分割数: %s', songsToUpdate.length, chunks.length)

  const endpoint = CONFIG.baseUrl + LEVELS_ENDPOINT
  let totalUpdated = 0
  let totalErrors = 0

  chunks.forEach((chunk, idx) => {
    Logger.log('送信開始 (%s/%s) %s件', idx + 1, chunks.length, chunk.length)
    const payload = {
      songs: chunk.map(item => ({ id: item.id, level: item.level })),
    }
    const result = updateLevelsBatch(endpoint, payload, importSecret)

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

function loadLevelsSheetData(spreadsheetId, sheetName) {
  if (!spreadsheetId) return { entries: [], sheet: null }

  const ss = SpreadsheetApp.openById(spreadsheetId)
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0]

  if (!sheet) {
    Logger.log('シートが見つかりません: %s', sheetName || '先頭シート')
    return { entries: [], sheet: null }
  }

  const [headers, ...rows] = sheet.getDataRange().getValues()
  const colMap = headers.map(h => LEVELS_COLUMN_MAP[String(h).trim()] || '')

  const entries = rows
    .map((row, idx) => parseLevelsRow(row, colMap, idx + 2))
    .filter(Boolean)

  return { entries, sheet }
}

function parseLevelsRow(row, colMap, rowIndex) {
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

function updateLevelsBatch(endpoint, payload, importSecret) {
  try {
    const res = fetchJsonWithRedirect('patch', endpoint, payload, importSecret)
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('難易度更新')
    .addItem('全行を更新', 'updateAllLevels')
    .addToUi()
}
