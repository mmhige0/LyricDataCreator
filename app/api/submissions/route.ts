import { notifySubmission } from '@/lib/submissions/discord'
import { prisma } from '@/lib/db'
import { checkId, editToken, endpoint, hashToken, json, readJson } from '@/lib/submissions/http'
import { GAME_SONG_ID, object, parseSubmission, SubmissionError } from '@/lib/submissions/validation'
import { consumeQuota, lockSubmission, owned, privateSubmission } from '@/lib/submissions/service'
import { verifyTurnstile } from '@/lib/submissions/turnstile'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  return endpoint(async () => {
    const token = editToken(request)
    const body = object(await readJson(request))
    const id = String(body.id ?? '')
    checkId(id)
    const input = parseSubmission(body)
    const gameSongId = body.gameSongId ?? null
    if (gameSongId !== null && (typeof gameSongId !== 'string' || !GAME_SONG_ID.test(gameSongId))) {
      throw new SubmissionError(400, '曲番号が不正です。')
    }
    await verifyTurnstile(body.turnstileToken)
    const { row, changed } = await prisma.$transaction(async tx => {
      await lockSubmission(tx, id)
      const existing = await tx.chartSubmission.findUnique({ where: { id } })
      // A lost success response can be retried without a duplicate submission or quota charge.
      if (existing) {
        const current = owned(existing, token)
        if (current.gameSongId !== gameSongId || !Object.entries(input).every(([key, value]) => current[key as keyof typeof input] === value)) {
          throw new SubmissionError(409, '投稿は保存済みです。投稿内容を読み込んでから変更してください。')
        }
        return { row: current, changed: false }
      }
      const source = gameSongId !== null ? await tx.song.findUnique({ where: { gameSongId } }) : null
      if (gameSongId !== null && !source) throw new SubmissionError(404, '修正対象の公開曲が見つかりません。')
      await consumeQuota(tx, true)
      const row = await tx.chartSubmission.create({ data: { id, editTokenHash: hashToken(token), gameSongId, level: source?.level ?? null, ...input } })
      return { row, changed: true }
    })
    const discordNotification = changed ? await notifySubmission(row, 'new') : 'unchanged'
    return json({ ...privateSubmission(row), discordNotification }, 201)
  })
}
