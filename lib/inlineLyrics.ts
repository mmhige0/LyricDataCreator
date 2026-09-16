import type { LyricsArray, ScoreEntry } from './types'
import { preprocessAndConvertLyrics } from './textUtils'

export function updateLyricsLine(entries: ScoreEntry[], id: string, line: number, value: string) {
  return entries.map(entry => {
    if (entry.id !== id || line < 0 || line > 3) return entry
    const lyrics = [...entry.lyrics] as LyricsArray
    lyrics[line] = value
    return { ...entry, lyrics }
  })
}

export function finishLyricsLine(entries: ScoreEntry[], id: string, line: number, value: string) {
  return updateLyricsLine(entries, id, line, preprocessAndConvertLyrics(value))
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function splitLyricsLine(lyrics: LyricsArray, line: number, start: number, end: number): LyricsArray {
  if (line < 0 || line >= 3) return lyrics
  const result = [...lyrics] as LyricsArray
  const remainder = lyrics[line].slice(end)
  const next = lyrics[line + 1]
  result[line] = lyrics[line].slice(0, start)
  result[line + 1] = `${remainder}${remainder && next ? '　' : ''}${next}`
  return result
}
