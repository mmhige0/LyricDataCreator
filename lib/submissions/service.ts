import { createHmac } from 'node:crypto'
import { Prisma, type ChartSubmission } from '@prisma/client'
import { hashToken, secureEqual } from './http'
import { SubmissionError } from './validation'

export function owned(row: ChartSubmission | null, token: string): ChartSubmission {
  if (!row || !secureEqual(row.editTokenHash, hashToken(token))) throw new SubmissionError(404, '投稿が見つからないか、編集用キーが違います。')
  return row
}
export function privateSubmission({ editTokenHash: _secret, ...row }: ChartSubmission) { return row }

export async function lockSubmission(tx: Prisma.TransactionClient, id: string) {
  // Parameterized SQL; hash collisions only serialize unrelated operations.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`submission:${id}`}))`
}
function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1) throw new SubmissionError(503, '投稿制限の設定が不正です。')
  return value
}
export async function consumeQuota(tx: Prisma.TransactionClient, ip: string, isNew: boolean) {
  const secret = process.env.SUBMISSION_RATE_SECRET
  if (!secret || secret.length < 32) throw new SubmissionError(503, '投稿制限が未設定です。')
  // One lock across instances makes the site-wide and per-IP limits atomic.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(164329, 1)`
  const now = new Date()
  const day = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
  const expiresAt = new Date(`${day}T00:00:00+09:00`)
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 1)
  const ipHash = createHmac('sha256', secret).update(ip).digest('hex')
  const counters = [
    { key: `day:${day}`, max: limit('SUBMISSION_DAILY_LIMIT', 50) },
    { key: `ip:${day}:${ipHash}`, max: limit('SUBMISSION_IP_DAILY_LIMIT', 5) },
  ]
  for (const { key, max } of counters) {
    const counter = await tx.submissionQuota.findUnique({ where: { key } })
    if (counter && counter.count >= max) throw new SubmissionError(429, '本日の投稿・変更回数の上限に達しました。翌日お試しください。')
  }
  if (isNew && await tx.chartSubmission.count() >= limit('SUBMISSION_TOTAL_LIMIT', 500)) throw new SubmissionError(429, '投稿の受付上限に達しています。')
  for (const { key } of counters) await tx.submissionQuota.upsert({ where: { key }, create: { key, count: 1, expiresAt }, update: { count: { increment: 1 } } })
  await tx.submissionQuota.deleteMany({ where: { expiresAt: { lte: now } } })
}
