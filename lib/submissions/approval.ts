import { prisma } from '@/lib/db'
import { parseLevelValue } from '@/lib/levels'
import { revalidateSongCache, revalidateSongsCache } from '@/lib/songQueries'
import { GAME_SONG_ID, SubmissionError } from './validation'
import { lockApprovalSong, lockSubmission } from './service'
import { findRankingSong, parseRegistration, sameRegistration, type Registration } from './registration'

export async function approveSubmission(id: string, expected: number, gameSongId: string, requested?: Registration, allowOverwrite = false) {
  if (!GAME_SONG_ID.test(gameSongId)) throw new SubmissionError(400, '曲番号は000以外の3〜8桁の数字にしてください。')
  const key = process.env.RANKING_ADMIN_API_KEY
  if (!key) throw new SubmissionError(503, 'ランキング連携が未設定です。')
  // Save the registration fields before any external write; publishing rows cannot be edited.
  await prisma.$transaction(async tx => {
    await lockApprovalSong(tx, gameSongId)
    await lockSubmission(tx, id)
    const current = await tx.chartSubmission.findUnique({ where: { id } })
    if (!current) throw new SubmissionError(404, '投稿が見つかりません。')
    if (current.revision !== expected) throw new SubmissionError(409, '申請が更新されました。内容を確認し直してください。')
    if (current.status === 'publishing') {
      if (current.gameSongId !== gameSongId) throw new SubmissionError(409, '承認処理中の曲番号は変更できません。')
      const reserved = parseRegistration(current)
      if (requested && !sameRegistration(reserved, requested)) throw new SubmissionError(409, '承認処理中の登録内容は変更できません。同じ内容で再試行してください。')
      return
    }
    if (current.status !== 'pending') throw new SubmissionError(409, '承認待ちの申請ではありません。')
    const other = await tx.chartSubmission.findFirst({ where: { status: 'publishing', id: { not: id }, gameSongId } })
    if (other) throw new SubmissionError(409, 'この曲の別の申請が承認処理中です。先にその処理を完了してください。')
    const publicSong = await tx.song.findUnique({ where: { gameSongId } })
    const rankingSong = await findRankingSong(gameSongId)
    if ((rankingSong || publicSong) && !allowOverwrite) throw new SubmissionError(409, 'この曲番号は登録済みです。既存曲を更新することを確認してください。')
    const registration = requested ?? parseRegistration({ ...current, gameSongId })
    await tx.chartSubmission.update({ where: { id }, data: { ...registration, status: 'publishing' } })
  }, { maxWait: 20000, timeout: 20000 })
  const saved = await prisma.$transaction(async tx => {
    await lockApprovalSong(tx, gameSongId)
    await lockSubmission(tx, id)
    const row = await tx.chartSubmission.findUnique({ where: { id } })
    if (!row) throw new SubmissionError(404, '申請は承認済み、または削除されています。')
    if (row.status !== 'publishing' || row.revision !== expected || row.gameSongId !== gameSongId) throw new SubmissionError(409, '承認状態が変わりました。')
    const registration = parseRegistration(row)
    if (requested && !sameRegistration(registration, requested)) throw new SubmissionError(409, '承認処理中の登録内容は変更できません。')
    const { title, artist, level } = registration
    let response: Response
    try {
      response = await fetch(`https://ranking.kayomodoki.com/api/v1/admin/songs/${gameSongId}`, {
        method: 'PUT', redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist, level }),
        signal: AbortSignal.timeout(10000), cache: 'no-store',
      })
    } catch { throw new SubmissionError(502, 'ランキングへの登録結果を確認できません。同じ登録内容で承認を再試行してください。') }
    if (!response.ok) throw new SubmissionError(502, 'ランキング登録に失敗しました。設定を確認し、同じ内容で再試行してください。')
    let confirmation
    try { confirmation = await response.json() }
    catch { throw new SubmissionError(502, 'ランキングの応答を確認できません。同じ内容で再試行してください。') }
    if (confirmation.song?.gameSongId !== gameSongId || confirmation.song?.title !== title || confirmation.song?.artist !== artist || confirmation.song?.level !== level) throw new SubmissionError(502, 'ランキングの登録内容を確認できません。')
    const data = {
      title, artist, level, levelValue: parseLevelValue(level),
      youtubeUrl: row.youtubeUrl, creatorName: row.creatorName, gameSongId,
      scoreTxt: row.txtContent, notes: row.notes,
    }
    await tx.song.upsert({ where: { gameSongId }, create: data, update: data })
    await tx.chartSubmission.delete({ where: { id } })
    return { status: 'approved', gameSongId }
  }, { maxWait: 20000, timeout: 20000 })
  revalidateSongsCache()
  revalidateSongCache(gameSongId)
  return saved
}
