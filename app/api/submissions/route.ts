import { prisma } from '@/lib/db'
import { checkId, clientIp, editToken, endpoint, hashToken, json, readJson, requirePosting } from '@/lib/submissions/http'
import { object, parseSubmission, SubmissionError } from '@/lib/submissions/validation'
import { consumeQuota, lockSubmission, owned, privateSubmission } from '@/lib/submissions/service'
import { verifyTurnstile } from '@/lib/submissions/turnstile'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  return endpoint(async () => {
    requirePosting()
    const token = editToken(request)
    const body = object(await readJson(request))
    const id = String(body.id ?? '')
    checkId(id)
    const input = parseSubmission(body)
    const ip = clientIp(request)
    await verifyTurnstile(body.turnstileToken, ip)
    const row = await prisma.$transaction(async tx => {
      await lockSubmission(tx, id)
      const existing = await tx.chartSubmission.findUnique({ where: { id } })
      // A lost success response can be retried without a duplicate submission or quota charge.
      if (existing) {
        const current = owned(existing, token)
        if (!Object.entries(input).every(([key, value]) => current[key as keyof typeof input] === value)) {
          throw new SubmissionError(409, '投稿は保存済みです。投稿内容を読み込んでから変更してください。')
        }
        return current
      }
      await consumeQuota(tx, ip, true)
      return tx.chartSubmission.create({ data: { id, editTokenHash: hashToken(token), ...input } })
    })
    return json(privateSubmission(row), 201)
  })
}
