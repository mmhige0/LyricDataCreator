import type { ScoreEntry, LyricsArray } from '@/lib/types'
import { preprocessAndConvertLyrics } from '@/lib/textUtils'

export interface LrcEntry {
  timestamp: number
  lyrics: string
}

const formatTimestampForLrc = (timestamp: number): string => {
  const safeTimestamp = Math.max(0, timestamp)
  let minutes = Math.floor(safeTimestamp / 60)
  const secondsFloat = safeTimestamp - minutes * 60
  let seconds = Math.floor(secondsFloat)
  let centiseconds = Math.round((secondsFloat - seconds) * 100)

  if (centiseconds === 100) {
    centiseconds = 0
    seconds += 1
  }

  if (seconds === 60) {
    seconds = 0
    minutes += 1
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

/**
 * LRCファイルの内容を解析してLrcEntryの配列に変換
 */
const parseLrcContent = (content: string): LrcEntry[] => {
  const lines = content.split('\n').filter(line => line.trim())
  const entries: LrcEntry[] = []

  for (const line of lines) {
    const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/)
    if (match) {
      const [, minutes, seconds, centiseconds, lyrics] = match
      const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100

      // 空行も含めてすべてのエントリを追加
      entries.push({
        timestamp,
        lyrics: lyrics.trim()
      })
    }
  }

  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * LrcEntryの配列をScoreEntryの配列に変換（基本的なテキスト変換付き）
 */
const convertLrcToScoreEntries = (lrcEntries: LrcEntry[]): ScoreEntry[] => {
  return lrcEntries.map((entry, index) => ({
    id: `lrc-${Date.now()}-${index}`,
    timestamp: entry.timestamp,
    lyrics: [preprocessAndConvertLyrics(entry.lyrics), '', '', ''] as LyricsArray
  }))
}

/**
 * LRCファイルの内容を直接ScoreEntryの配列に変換
 */
export const parseLrcToScoreEntries = (content: string): ScoreEntry[] => {
  const lrcEntries = parseLrcContent(content)
  return convertLrcToScoreEntries(lrcEntries)
}

const selectLyricLine = (lyrics: LyricsArray): string => {
  const nonEmpty = lyrics.find((line) => line.trim() !== '')
  return nonEmpty ?? ''
}

export const createLrcFromScoreEntries = (
  entries: ScoreEntry[],
  options?: {
    title?: string
    duration?: number
  }
): string => {
  const lines: string[] = []
  const normalizedTitle = options?.title?.trim()

  if (normalizedTitle) {
    lines.push(`[ti:${normalizedTitle}]`)
  }

  if (typeof options?.duration === 'number' && options.duration > 0) {
    lines.push(`[length:${formatTimestampForLrc(options.duration)}]`)
  }

  const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp)
  sortedEntries.forEach((entry) => {
    lines.push(`[${formatTimestampForLrc(entry.timestamp)}]${selectLyricLine(entry.lyrics)}`)
  })

  return lines.join('\n')
}
