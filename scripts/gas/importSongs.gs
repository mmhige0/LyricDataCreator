// 実行前に下記を設定してください。
// 1. スクリプト プロパティに IMPORT_SECRET を保存（エディタ:「プロジェクトのプロパティ」→「スクリプトのプロパティ」）。
// 2. TXT を置く Drive フォルダ ID を設定。
// 3. メタ情報を載せたスプレッドシート ID とシート名を設定（シート名が空なら先頭シートを使用）。
const CONFIG = {
  endpoint: 'https://lyric-data-creator.vercel.app/import-songs',
  folderId: 'replace-with-folder-id', // TXT を置く Drive フォルダ ID
  spreadsheetId: 'replace-with-spreadsheet-id', // 曲メタ情報を載せたスプレッドシート ID
  sheetName: '', // 使うシート名（空なら先頭シート）
  noUpdate: true, // true なら既存タイトルはスキップ（更新しない）
  truncate: false, // true ならインポート前に全削除
}

function main() {
  const folder = DriveApp.getFolderById(CONFIG.folderId)
  const sheetMap = loadSheetMap(CONFIG.spreadsheetId, CONFIG.sheetName)
  const songs = collectTxtSongs(folder, sheetMap)

  if (!songs.length) {
    Logger.log('No songs to send')
    return
  }

  const payload = {
    noUpdate: CONFIG.noUpdate,
    truncate: CONFIG.truncate,
    songs,
  }

  const importSecret = getImportSecret()
  if (!importSecret) {
    Logger.log('Import secret is not configured. Set IMPORT_SECRET in script properties.')
    return
  }

  const res = UrlFetchApp.fetch(CONFIG.endpoint, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-import-secret': importSecret,
    },
    payload: JSON.stringify(payload),
  })

  Logger.log('Status: %s', res.getResponseCode())
  Logger.log(res.getContentText())
}

function collectTxtSongs(folder, metaMap) {
  const songs = []
  const files = folder.getFiles()
  while (files.hasNext()) {
    const file = files.next()
    const name = file.getName()
    if (!name.toLowerCase().endsWith('.txt')) continue

    const baseName = ensureTxtExtension(name)
    const meta = metaMap[baseName] || {}
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

function loadSheetMap(spreadsheetId, sheetName) {
  if (!spreadsheetId) return {}
  const ss = SpreadsheetApp.openById(spreadsheetId)
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0]
  if (!sheet) {
    Logger.log('Sheet not found: %s', sheetName || 'first sheet')
    return {}
  }
  const values = sheet.getDataRange().getValues()
  if (!values || values.length < 2) return {}
  const cols = values[0].map((col) => String(col || '').trim())
  const map = {}
  for (let i = 1; i < values.length; i += 1) {
    const rowValues = values[i]
    const row = {}
    cols.forEach((col, idx) => {
      if (!col) return
      row[col] = String(rowValues[idx] || '').trim()
    })
    if (!row.file || !Object.values(row).some((v) => v)) continue
    const key = ensureTxtExtension(row.file)
    map[key] = row
  }
  return map
}

function ensureTxtExtension(filePath) {
  if (!filePath) return filePath
  return filePath.toLowerCase().endsWith('.txt') ? filePath : `${filePath}.txt`
}

function titleFromFilename(name) {
  const base = name.replace(/\.txt$/i, '')
  return base.replace(/_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '') || base
}

function getImportSecret() {
  const props = PropertiesService.getScriptProperties()
  return props.getProperty('IMPORT_SECRET')
}
