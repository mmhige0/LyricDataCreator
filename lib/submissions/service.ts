import { Prisma, type ChartSubmission } from '@prisma/client'
import { hashToken, secureEqual } from './http'
import { SubmissionError } from './validation'

export function owned(row: ChartSubmission | null, token: string): ChartSubmission {
  if (!row || !secureEqual(row.editTokenHash, hashToken(token))) throw new SubmissionError(404, '投稿が見つからないか、編集用キーが違います。承認済みの申請は削除され、編集URLは使えません。')
  return row
}
export function privateSubmission({ editTokenHash: _secret, ...row }: ChartSubmission) { return row }

export async function lockSubmission(tx: Prisma.TransactionClient, id: string) {
  // Parameterized SQL; hash collisions only serialize unrelated operations.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`submission:${id}`}))`
}
// Always acquire the song lock before a submission lock in approval transactions.
export async function lockApprovalSong(tx: Prisma.TransactionClient, gameSongId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`approval-song:${gameSongId}`}))`
}
function limit(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1) throw new SubmissionError(503, '投稿制限の設定が不正です。')
  return value
}
export async function ensureSubmissionCapacity(tx: Prisma.TransactionClient) {
  // Serialize new submissions so concurrent requests cannot exceed the stored-row limit.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(164329, 1)`
  if (await tx.chartSubmission.count() >= limit('SUBMISSION_TOTAL_LIMIT', 50)) throw new SubmissionError(429, '投稿の受付上限に達しています。')
}
