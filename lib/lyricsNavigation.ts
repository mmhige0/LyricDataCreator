import type { ScoreEntry } from './types'

export interface LyricsPosition {
  id: string
  line: number
}

export function adjacentLyricsPosition(
  entries: ScoreEntry[],
  position: LyricsPosition,
  direction: -1 | 1,
  unit: 'line' | 'page',
): LyricsPosition | null {
  const index = entries.findIndex(entry => entry.id === position.id)
  if (index < 0 || position.line < 0 || position.line > 3) return null
  const offset = unit === 'page' ? direction * 4 : direction
  const target = index * 4 + position.line + offset
  if (target < 0 || target >= entries.length * 4) return null
  return { id: entries[Math.floor(target / 4)].id, line: target % 4 }
}

export function pagePlaybackTimestamp(entries: ScoreEntry[], selectedId: string | null): number | null {
  const entry = entries.find(item => item.id === selectedId)
  if (!entry) return null
  return Number.isFinite(entry.timestamp) && entry.timestamp >= 0 ? entry.timestamp : null
}
