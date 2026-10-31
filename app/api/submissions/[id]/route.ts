import { notifySubmission } from '@/lib/submissions/discord'
import { prisma } from '@/lib/db'
import { checkId, clientIp, editToken, endpoint, json, readJson, requirePosting } from '@/lib/submissions/http'
import { object, parseSubmission, revision, SubmissionError } from '@/lib/submissions/validation'
import { consumeQuota, lockSubmission, owned, privateSubmission } from '@/lib/submissions/service'
import { verifyTurnstile } from '@/lib/submissions/turnstile'

type Context = { params: Promise<{ id: string }> }
export const runtime = 'nodejs'
export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const { id } = await context.params
    checkId(id)
    const token = editToken(request)
    return json(privateSubmission(owned(await prisma.chartSubmission.findUnique({ where: { id } }), token)))
  })
}
export async function PUT(request: Request, context: Context) {
  return endpoint(async () => {
    requirePosting()
    const { id } = await context.params
    checkId(id)
    const token = editToken(request)
    const body = object(await readJson(request))
    const input = parseSubmission(body)
    const expected = revision(body.revision)
    const ip = clientIp(request)
    await verifyTurnstile(body.turnstileToken, ip)
    const { row, changed } = await prisma.$transaction(async tx => {
      await lockSubmission(tx, id)
      const current = owned(await tx.chartSubmission.findUnique({ where: { id } }), token)
      if (current.status === 'publishing') throw new SubmissionError(409, '承認処理中のため変更できません。')
      // Idempotent retry after a lost update response.
      if (current.revision === expected + 1 && current.status === 'pending' && Object.entries(input).every(([key, value]) => current[key as keyof typeof input] === value)) return { row: current, changed: false }
      if (current.revision !== expected) throw new SubmissionError(409, '別の画面で変更されています。読み込み直してください。')
      await consumeQuota(tx, ip, false)
      const row = await tx.chartSubmission.update({ where: { id }, data: { ...input, status: 'pending', revision: { increment: 1 } } })
      return { row, changed: true }
    })
    const discordNotification = changed ? await notifySubmission(row, 'updated') : 'unchanged'
    return json({ ...privateSubmission(row), discordNotification })
  })
}
