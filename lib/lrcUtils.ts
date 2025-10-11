import type { ScoreEntry, LyricsArray } from '@/lib/types'
import { preprocessAndConvertLyrics } from '@/lib/textUtils'

export interface LrcEntry {
  timestamp: number
  lyrics: string
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