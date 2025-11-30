export type SongSummary = {
  id: number
  title: string
  artist: string | null
  youtubeUrl: string
  level: string | null
}

export type SongsResponse = {
  data: SongSummary[]
  total: number
  page: number
  totalPages: number
  pageSize: number
}

export const SONG_SORT_KEYS = ["id", "title", "artist", "level"] as const
export type SongSortKey = (typeof SONG_SORT_KEYS)[number]
export type SongSortDirection = "asc" | "desc"

export const SONGS_PAGE_SIZE = 50
export const SONGS_PAGE_SIZE_MAX = 200
