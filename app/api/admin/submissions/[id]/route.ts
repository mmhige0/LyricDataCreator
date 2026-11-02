import { parseRegistration, parseRegistrationDraft } from '@/lib/submissions/registration'
import { notifySubmission } from '@/lib/submissions/discord'
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
    if (body.action === 'notify') {
      const row = await prisma.chartSubmission.findUnique({ where: { id } })
      if (!row || row.revision !== expected) throw new SubmissionError(409, '申請が更新されました。内容を確認し直してください。')
      return json({ discordNotification: await notifySubmission(row, 'resend') })
    }
    if (body.action === 'approve') {
      const registration = body.registration === undefined ? undefined : parseRegistration(body.registration)
      return json(await approveSubmission(id, expected, registration?.gameSongId ?? String(body.gameSongId ?? ''), registration, body.allowOverwrite === true))
    }
    if (body.action === 'save') {
      const registration = parseRegistrationDraft(body.registration)
      const row = await prisma.$transaction(async tx => {
        await lockSubmission(tx, id)
        const current = await tx.chartSubmission.findUnique({ where: { id } })
        if (!current || current.revision !== expected || current.status === 'publishing') throw new SubmissionError(409, '申請が更新されたか、承認処理中です。')
        return tx.chartSubmission.update({ where: { id }, data: { ...registration, revision: { increment: 1 } } })
      })
      return json(privateSubmission(row))
    }
    if (body.action !== 'reject' && body.action !== 'restore') throw new SubmissionError(400, '操作が不正です。')
    const row = await prisma.$transaction(async tx => {
      await lockSubmission(tx, id)
      const current = await tx.chartSubmission.findUnique({ where: { id } })
      const from = body.action === 'restore' ? 'rejected' : 'pending'
      if (!current || current.revision !== expected || current.status !== from) throw new SubmissionError(409, '申請が更新されたか、状態が変わっています。')
      return tx.chartSubmission.update({ where: { id }, data: { status: body.action === 'restore' ? 'pending' : 'rejected', revision: { increment: 1 } } })
    })
    return json(privateSubmission(row))
  })
}
