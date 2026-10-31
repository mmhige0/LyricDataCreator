import { getSongByGameSongId } from '@/lib/songQueries'
import { endpoint, json } from '@/lib/submissions/http'
import { GAME_SONG_ID, SubmissionError } from '@/lib/submissions/validation'
import { createScoreTxt } from '@/lib/scoreFormat'
import { parseScoreEntries } from '@/lib/scoreSerialization'

export const runtime = 'nodejs'
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    const { id } = await context.params
    if (!GAME_SONG_ID.test(id)) throw new SubmissionError(400, '曲番号が不正です。')
    const song = await getSongByGameSongId(id)
    if (!song) throw new SubmissionError(404, '公開曲が見つかりません。')
    const entries = parseScoreEntries(song.scoreEntries)
    // Legacy imports may only have parsed pages; preserve them until TXT is reimported.
    const txtContent = song.scoreTxt ?? createScoreTxt(Math.max(0, ...entries.map(row => row.timestamp)) + 5, entries, [])
    return json({ gameSongId: id, title: song.title, artist: song.artist, notes: song.notes,
      youtubeUrl: song.youtubeUrl, creatorName: '', txtContent })
  })
}
