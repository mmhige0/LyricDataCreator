import { parseScoreTxt } from '@/lib/scoreFormat'

export const MAX_BODY_BYTES = 160 * 1024
export const MAX_TXT_BYTES = 128 * 1024
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
export const EDIT_TOKEN = /^[A-Za-z0-9_-]{43}$/
export const GAME_SONG_ID = /^(?!000$)[0-9]{3,8}$/

export class SubmissionError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SubmissionError(400, '入力形式が不正です。')
  return value as Record<string, unknown>
}

function text(value: unknown, max: number, required = true, multiline = false): string {
  if (typeof value !== 'string') throw new SubmissionError(400, '文字列を入力してください。')
  const result = value.trim()
  if ((required && !result) || [...result].length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\uD800-\uDFFF]/u : /[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF]/u).test(result)) {
    throw new SubmissionError(400, `項目の長さ・文字が不正です（最大${max}文字）。`)
  }
  return result
}

export function canonicalYouTubeUrl(value: unknown): string {
  const input = text(value, 500)
  let url: URL
  try { url = new URL(input) } catch { throw new SubmissionError(400, 'YouTube URLが不正です。') }
  const host = url.hostname.toLowerCase()
  const id = host === 'youtu.be' ? url.pathname.slice(1) :
    ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host) ?
      url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1] : null
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !id || !/^[\w-]{11}$/.test(id)) {
    throw new SubmissionError(400, 'HTTPSのYouTube動画URLを入力してください。')
  }
  // Never fetch arbitrary user-supplied URLs on the server.
  return `https://www.youtube.com/watch?v=${id}`
}

export function parseSubmission(value: unknown) {
  const input = object(value)
  const creatorName = text(input.creatorName, 40)
  const title = text(input.title, 200)
  const artist = text(input.artist ?? '', 200, false) || null
  const level = text(input.level ?? '', 4, false) || null
  if (level && !/^(?:[1-9][0-9]?[+-]?|[-?])$/.test(level)) throw new SubmissionError(400, '難易度が不正です。')
  const notes = text(input.notes ?? '', 2000, false, true)
  const youtubeUrl = canonicalYouTubeUrl(input.youtubeUrl)
  if (typeof input.txtContent !== 'string' || new TextEncoder().encode(input.txtContent).length > MAX_TXT_BYTES) {
    throw new SubmissionError(413, '譜面は128KiB以内にしてください。')
  }
  // Bound lines before parsing, including empty rows and pop rows.
  if (input.txtContent.split(/\r\n|\n|\r/).length > 2200) throw new SubmissionError(400, '譜面の行数が多すぎます。')
  let parsed: ReturnType<typeof parseScoreTxt>
  try { parsed = parseScoreTxt(input.txtContent) }
  catch (error) { throw new SubmissionError(400, error instanceof Error ? error.message : '譜面が不正です。') }
  if (!parsed.scoreEntries.length || parsed.scoreEntries.length > 1000 || parsed.centralPops.length > 1000 || parsed.duration > 3600) {
    throw new SubmissionError(400, '譜面は1〜1000ページ、ポップ1000件以下、総時間3600秒以下にしてください。')
  }
  if ([...parsed.scoreEntries, ...parsed.centralPops].some(row => row.timestamp > parsed.duration)) {
    throw new SubmissionError(400, '総時間を超える表示時刻があります。')
  }
  return { creatorName, title, artist, level, youtubeUrl, txtContent: input.txtContent, notes }
}

export function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new SubmissionError(400, '版番号が不正です。')
  return value
}
