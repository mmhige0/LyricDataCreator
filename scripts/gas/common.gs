// ========================================
// 共通設定・ユーティリティ
// ========================================
// 【セットアップ手順】
// 1. Google Apps Script プロジェクトを作成し、必要なスクリプトを貼り付ける
//    - common.gs（必須）
//    - importSongs.gs（歌詞インポート用）
//    - updateLevels.gs（難易度更新用）
// 2. 下記の CONFIG を編集
//    - spreadsheetId: 曲一覧スプレッドシートの ID
//    - sheetName: 使うシート名
//    - folderId: 歌詞データ(.txt) を置く Drive フォルダ ID
// 3. スクリプト プロパティに IMPORT_SECRET を設定
//    - 「プロジェクト設定」>「スクリプト プロパティ」>「スクリプト プロパティを追加」から登録
//    - LAST_SCAN_AT は自動更新（全曲再送したい時は削除）
// 4. スプレッドシートを準備
//    - 列（順不同）: 曲番, 曲URL, 曲名, アーティスト名, 難易度
// 5. Drive の対象フォルダに歌詞 .txt を配置（ファイル名は曲番と対応）
// 6. main() または updateAllLevels() を実行
//    - 初回実行時は Drive/Spreadsheet/外部送信の許可ダイアログを承認
// ========================================

const CONFIG = {
  baseUrl: 'https://lyric-data-creator.vercel.app',
  spreadsheetId: 'replace-with-spreadsheet-id', // 曲情報を載せたスプレッドシート ID
  sheetName: '', // 使うシート名（空なら先頭シート）

  // importSongs 用
  folderId: 'replace-with-folder-id', // 歌詞データ(.txt) を置く Drive フォルダ ID
  noUpdate: true, // true: 既存曲はスキップ / false: 既存曲も更新
  maxSongsPerImport: 100, // インポート時の1リクエストあたり曲数上限

  // updateLevels 用
  maxSongsPerLevelUpdate: 1000, // 難易度更新時の1リクエストあたり曲数上限
}

// ========================================
// ユーティリティ関数
// ========================================

function chunkArray(array, size) {
  if (!size || size <= 0) return [array]
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
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

function fetchJsonWithRedirect(method, url, body, importSecret) {
  const options = {
    method: method,
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

function getImportSecret() {
  return PropertiesService.getScriptProperties().getProperty('IMPORT_SECRET')
}
