import { GAME_SONG_ID, object, SubmissionError, text } from './validation'

export type Registration = { gameSongId: string; title: string; artist: string | null; level: string | null }
export function parseRegistration(value: unknown): Registration {
  const input = object(value)
  if (typeof input.gameSongId !== 'string' || !GAME_SONG_ID.test(input.gameSongId)) throw new SubmissionError(400, '曲番号は000以外の3〜8桁の数字にしてください。')
  const title = text(input.title, 200)
  const artist = input.artist == null ? null : text(input.artist, 200, false) || null
  const level = input.level == null ? null : text(input.level, 4, false) || null
  if (level && !/^(?:[1-9][0-9]?[+-]?|[-?])$/.test(level)) throw new SubmissionError(400, '難易度が不正です。')
  return { gameSongId: input.gameSongId, title, artist, level }
}
export function sameRegistration(a: Registration, b: Registration) {
  return a.gameSongId === b.gameSongId && a.title === b.title && a.artist === b.artist && a.level === b.level
}

export async function findRankingSong(gameSongId: string): Promise<Registration | null> {
  if (!GAME_SONG_ID.test(gameSongId)) throw new SubmissionError(400, '曲番号が不正です。')
  try {
    // The ranking endpoint returns the exact song even when it has no play records.
    const response = await fetch(`https://ranking.kayomodoki.com/api/v1/songs/${gameSongId}/rankings?players=1&limit=1`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Ranking unavailable')
    const data = await response.json()
    const song = parseRegistration(data.song)
    if (song.gameSongId !== gameSongId) throw new Error('Wrong song')
    return song
  } catch { throw new SubmissionError(502, 'ランキングの曲番号を確認できません。時間をおいて再確認してください。') }
}
