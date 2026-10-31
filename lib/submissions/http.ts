import { createHash, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse } from 'next/server'
import { EDIT_TOKEN, MAX_BODY_BYTES, SubmissionError, UUID } from './validation'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export function secureEqual(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(hashToken(left)), Buffer.from(hashToken(right)))
}
export function editToken(request: Request): string {
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]
  if (!token || !EDIT_TOKEN.test(token)) throw new SubmissionError(401, '編集用キーが必要です。')
  return token
}
export function checkId(id: string) {
  if (!UUID.test(id)) throw new SubmissionError(400, '投稿IDが不正です。')
}
export function requireAdmin(request: Request) {
  const secret = process.env.SUBMISSION_ADMIN_KEY
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!secret || secret.length < 32 || !token || !secureEqual(token, secret)) throw new SubmissionError(401, '管理者認証が必要です。')
}
export function requirePosting() {
  if (process.env.SUBMISSIONS_ENABLED !== 'true') throw new SubmissionError(503, '現在、投稿の受付を停止しています。')
}
export function clientIp(request: Request): string {
  // This header is overwritten by Vercel. Do not trust arbitrary proxy headers elsewhere.
  if (process.env.VERCEL === '1') {
    const ip = request.headers.get('x-forwarded-for')?.trim()
    if (ip && isIP(ip)) return ip
    throw new SubmissionError(503, '接続元を確認できません。')
  }
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return '127.0.0.1'
  throw new SubmissionError(503, '投稿受付の接続元制限が未設定です。')
}
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SubmissionError(415, 'JSON形式で送信してください。')
  if (!request.body) throw new SubmissionError(400, '本文がありません。')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new SubmissionError(413, '投稿サイズが大きすぎます。') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new SubmissionError(400, 'JSONが不正です。') }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
export async function endpoint(action: () => Promise<Response>) {
  try { return await action() }
  catch (error) {
    if (error instanceof SubmissionError) {
      const response = json({ error: error.message }, error.status)
      if (error.status === 429) {
        const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
        const midnight = new Date(`${day}T00:00:00+09:00`).getTime() + 86400000
        response.headers.set('Retry-After', String(Math.max(1, Math.ceil((midnight - Date.now()) / 1000))))
      }
      return response
    }
    // Never log submitted lyrics, edit tokens or database error query parameters.
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown'
    console.error('Submission operation failed', { code })
    return json({ error: '処理に失敗しました。同じ内容で再試行してください。' }, 500)
  }
}
