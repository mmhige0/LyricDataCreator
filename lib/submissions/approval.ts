import { prisma } from '@/lib/db'
import { parseLevelValue } from '@/lib/levels'
import { parseScoreTxt } from '@/lib/scoreFormat'
import { revalidateSongCache, revalidateSongsCache } from '@/lib/songQueries'
import { GAME_SONG_ID, SubmissionError } from './validation'
import { lockApprovalSong, lockApprovalTarget, lockSubmission } from './service'

export async function approveSubmission(id: string, expected: number, gameSongId: string) {
  if (!GAME_SONG_ID.test(gameSongId)) throw new SubmissionError(400, '曲番号は000以外の3〜8桁の数字にしてください。')
  const key = process.env.RANKING_ADMIN_API_KEY
  if (!key) throw new SubmissionError(503, 'ランキング連携が未設定です。')
  // Reserve an immutable version and song number BEFORE making an external request.
  await prisma.$transaction(async tx => {
    await lockApprovalSong(tx, gameSongId)
    await lockSubmission(tx, id)
    const current = await tx.chartSubmission.findUnique({ where: { id } })
    if (!current) throw new SubmissionError(404, '投稿が見つかりません。')
    if (current.revision !== expected) throw new SubmissionError(409, '申請が更新されました。内容を確認し直してください。')
    if (current.gameSongId && current.gameSongId !== gameSongId) throw new SubmissionError(409, '登録済み・承認処理中の曲番号は変更できません。')
    if (!['pending', 'publishing'].includes(current.status)) throw new SubmissionError(409, '承認待ちの申請ではありません。')
    if (current.publishedSongId) await lockApprovalTarget(tx, current.publishedSongId)
    const other = await tx.chartSubmission.findFirst({ where: {
      status: 'publishing', id: { not: id },
      OR: [{ gameSongId }, ...(current.publishedSongId ? [{ publishedSongId: current.publishedSongId }] : [])],
    } })
    if (other) throw new SubmissionError(409, 'この曲の別の申請が承認処理中です。先にその処理を完了してください。')
    if (current.publishedSongId) {
      const target = await tx.song.findUniqueOrThrow({ where: { id: current.publishedSongId } })
      if (target.gameSongId && target.gameSongId !== gameSongId) throw new SubmissionError(409, '修正対象の曲番号と一致しません。')
    }
    return tx.chartSubmission.update({ where: { id }, data: { status: 'publishing', gameSongId } })
  }, { maxWait: 20000, timeout: 20000 })
  // Keep cross-instance DB locks across the external write and local publication.
  // The earlier committed reservation survives failure so only this proposal can retry.
  const saved = await prisma.$transaction(async tx => {
    await lockApprovalSong(tx, gameSongId)
    await lockSubmission(tx, id)
    const row = await tx.chartSubmission.findUnique({ where: { id } })
    if (!row) throw new SubmissionError(404, '申請は承認済み、または削除されています。')
    if (row.status !== 'publishing' || row.revision !== expected || row.gameSongId !== gameSongId) throw new SubmissionError(409, '承認状態が変わりました。')
    if (row.publishedSongId) {
      await lockApprovalTarget(tx, row.publishedSongId)
      const target = await tx.song.findUniqueOrThrow({ where: { id: row.publishedSongId } })
      if (target.gameSongId && target.gameSongId !== gameSongId) throw new SubmissionError(409, '修正対象の曲番号と一致しません。')
    }
    let response: Response
    try {
      response = await fetch(`https://ranking.kayomodoki.com/api/v1/admin/songs/${gameSongId}`, {
        method: 'PUT',
        redirect: 'error',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: row.title, artist: row.artist, level: row.level }),
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      })
    } catch { throw new SubmissionError(502, 'ランキングへの登録結果を確認できません。同じ版・曲番号で承認を再試行してください。') }
    if (!response.ok) {
      throw new SubmissionError(502, 'ランキング登録に失敗しました。設定を確認し、同じ版・曲番号で再試行してください。')
    }
    let confirmation
    try { confirmation = await response.json() }
    catch { throw new SubmissionError(502, 'ランキングの応答を確認できません。同じ版・曲番号で再試行してください。') }
    if (confirmation.song?.gameSongId !== gameSongId || confirmation.song?.title !== row.title || confirmation.song?.artist !== row.artist || confirmation.song?.level !== row.level) throw new SubmissionError(502, 'ランキングの登録内容を確認できません。')
    const parsed = parseScoreTxt(row.txtContent)
    const data = {
      title: row.title, artist: row.artist, level: row.level, levelValue: parseLevelValue(row.level),
      youtubeUrl: row.youtubeUrl, creatorName: row.creatorName, gameSongId,
      scoreEntries: JSON.stringify(parsed.scoreEntries), scoreTxt: row.txtContent,
    }
    const song = row.publishedSongId
      ? await tx.song.update({ where: { id: row.publishedSongId }, data })
      : await tx.song.create({ data })
    // Publication and cleanup commit together; failures leave the reserved submission retryable.
    await tx.chartSubmission.delete({ where: { id } })
    return { status: 'approved', publishedSongId: song.id, gameSongId }
  }, { maxWait: 20000, timeout: 20000 })
  revalidateSongsCache()
  if (saved.publishedSongId) revalidateSongCache(saved.publishedSongId)
  return saved
}
