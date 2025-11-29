import type { ScoreEntry } from '@/lib/types'

export const serializeScoreEntries = (scoreEntries: ScoreEntry[]): string => JSON.stringify(scoreEntries)

export const parseScoreEntries = (payload: string): ScoreEntry[] => {
  const parsed = JSON.parse(payload)
  if (!Array.isArray(parsed)) {
    throw new Error('scoreEntries must be an array')
  }
  return parsed
}
