import type { SongSortDirection } from '@/types/songs'

// Preserve the original string for display and break equal-number ties as in the ranking site.
export function compareSongNumbers(a: string | null, b: string | null, direction: SongSortDirection) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  const sign = direction === 'asc' ? 1 : -1
  return sign * (Number(a) - Number(b) || (a < b ? -1 : a > b ? 1 : 0))
}
