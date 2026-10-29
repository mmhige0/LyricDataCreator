import { prisma } from '@/lib/db'
import { approveSubmission } from '@/lib/submissions/approval'
import { checkId, endpoint, json, readJson, requireAdmin } from '@/lib/submissions/http'
import { lockSubmission, privateSubmission } from '@/lib/submissions/service'
import { object, revision, SubmissionError } from '@/lib/submissions/validation'

type Context = { params: Promise<{ id: string }> }
export const runtime = 'nodejs'
export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    requireAdmin(request)
    const { id } = await context.params
    checkId(id)
    const row = await prisma.chartSubmission.findUnique({ where: { id } })
    if (!row) throw new SubmissionError(404, '投稿が見つかりません。')
    return json(privateSubmission(row))
  })
}
export async function POST(request: Request, context: Context) {
  return endpoint(async () => {
    requireAdmin(request)
    const { id } = await context.params
    checkId(id)
    const body = object(await readJson(request))
    const expected = revision(body.revision)
    if (body.action === 'approve') return json(await approveSubmission(id, expected, String(body.gameSongId ?? '')))
    if (body.action !== 'reject') throw new SubmissionError(400, '操作が不正です。')
    const row = await prisma.$transaction(async tx => {
      await lockSubmission(tx, id)
      const current = await tx.chartSubmission.findUnique({ where: { id } })
      if (!current || current.revision !== expected || current.status !== 'pending') throw new SubmissionError(409, '申請が更新されたか、承認処理中です。')
      return tx.chartSubmission.update({ where: { id }, data: { status: 'rejected' } })
    })
    return json(privateSubmission(row))
  })
}
