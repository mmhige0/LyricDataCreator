import { Prisma } from "@prisma/client"
import { revalidateTag, unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"
import { displayRangeToValueRange, normalizeDisplayLevelRange } from "@/lib/levels"
import {
  SONG_SORT_KEYS,
  SONGS_PAGE_SIZE,
  SONGS_PAGE_SIZE_MAX,
  type SongSortDirection,
  type SongSortKey,
  type SongsResponse,
  type SongSummary,
} from "@/types/songs"

export const SONGS_TAG = "songs"
const SONG_DETAIL_TAG_PREFIX = "song-detail-game-number"
const RANDOM_SONG_COUNT = 10

type SongsQuery = {
  search: string
  page: number
  pageSize?: number
  sortKey: SongSortKey
  sortDirection: SongSortDirection
  levelMin?: number | null
  levelMax?: number | null
}

type RandomSongsQuery = {
  search: string
  levelMin?: number | null
  levelMax?: number | null
  limit?: number
}

const buildLevelKey = (levelMin?: number | null, levelMax?: number | null) => {
  const normalized = normalizeDisplayLevelRange(levelMin, levelMax)
  return normalized ? `lvl:${normalized.min}-${normalized.max}` : "lvl:any"
}

const convertKatakanaToHiragana = (text: string): string =>
  text.replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))

const convertHiraganaToKatakana = (text: string): string =>
  text.replace(/[\u3041-\u3096]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))

const buildSearchVariants = (search: string) => {
  const hiragana = convertKatakanaToHiragana(search)
  const katakana = convertHiraganaToKatakana(search)
  return Array.from(new Set([search, hiragana, katakana])).filter((text) => text.length > 0)
}

const parseSearchId = (search: string) => {
  if (!/^\d+$/.test(search)) return null
  const parsed = Number.parseInt(search, 10)
  return Number.isNaN(parsed) ? null : parsed
}

const buildListKey = (params: {
  search: string
  sortKey: SongSortKey
  sortDirection: SongSortDirection
  page: number
  pageSize: number
  levelMin?: number | null
  levelMax?: number | null
}) => [
  "song-list-game-key-v3",
  `q:${params.search || "all"}`,
  `sort:${params.sortKey}:${params.sortDirection}`,
  `page:${params.page}`,
  `size:${params.pageSize}`,
  buildLevelKey(params.levelMin, params.levelMax),
]

const buildSearchFilter = (search: string) => {
  const variants = buildSearchVariants(search)
  const searchId = parseSearchId(search)

  if (variants.length === 0 && searchId === null) return undefined

  return {
    OR: [
      ...variants.flatMap((variant) => [
        { title: { contains: variant, mode: "insensitive" as const } },
        { artist: { contains: variant, mode: "insensitive" as const } },
      ]),
      ...(searchId !== null ? [{ gameSongId: { contains: search } }] : []),
    ],
  } satisfies Prisma.SongWhereInput
}

const buildSort = (sortKey: SongSortKey, sortDirection: SongSortDirection) => {
  const direction = sortDirection === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`
  const numberOrder = Prisma.sql`"gameSongId"::bigint ${direction} NULLS LAST, "gameSongId" COLLATE "C" ${direction}`
  // Keep the historical `id` sort parameter as an alias for public song number.
  if (sortKey === 'gameSongId' || sortKey === 'id') return numberOrder
  if (sortKey === 'level') return Prisma.sql`"levelValue" ${direction} ${sortDirection === 'asc' ? Prisma.sql`NULLS LAST` : Prisma.sql`NULLS FIRST`}, ${numberOrder}`
  const column = sortKey === 'artist' ? Prisma.sql`"artist"` : Prisma.sql`"title"`
  return Prisma.sql`${column} ${direction}, ${numberOrder}`
}

const buildWhereSql = (search: string, levelRange: ReturnType<typeof displayRangeToValueRange>) => {
  const conditions: Prisma.Sql[] = []
  const searchClauses = buildSearchVariants(search).map(variant => {
    const pattern = `%${variant}%`
    return Prisma.sql`("title" ILIKE ${pattern} OR "artist" ILIKE ${pattern})`
  })
  if (parseSearchId(search) !== null) searchClauses.push(Prisma.sql`"gameSongId" LIKE ${`%${search}%`}`)
  if (searchClauses.length) conditions.push(Prisma.sql`(${Prisma.join(searchClauses, ' OR ')})`)
  if (levelRange) conditions.push(Prisma.sql`"levelValue" BETWEEN ${levelRange.minValue} AND ${levelRange.maxValue}`)
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty
}

const clampPageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), SONGS_PAGE_SIZE_MAX)

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)
const DATABASE_CONNECTION_ERROR_CODES = new Set(["P1001", "P1002", "P1003", "P1017"])

const isDatabaseConnectionError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false
  const code = "code" in error ? error.code : undefined
  return typeof code === "string" && DATABASE_CONNECTION_ERROR_CODES.has(code)
}

const createEmptySongsResponse = (pageSize: number): SongsResponse => ({
  data: [],
  page: 1,
  pageSize,
  hasNext: false,
})

const logDatabaseConnectionFallback = (operation: string, error: unknown) => {
  console.warn(`Database is unavailable while loading ${operation}; returning empty data`, {
    error,
  })
}

const buildSongDetailKey = (gameSongId: string) => [SONG_DETAIL_TAG_PREFIX, gameSongId]
const buildSongDetailTag = (gameSongId: string) => `${SONG_DETAIL_TAG_PREFIX}:${gameSongId}`

export const getSongByGameSongId = async (gameSongId: string) => {
  if (!isDatabaseConfigured) return null

  try {
    return await unstable_cache(
      async () => prisma.song.findUnique({ where: { gameSongId } }),
      buildSongDetailKey(gameSongId),
      {
        tags: [buildSongDetailTag(gameSongId)],
        revalidate: false,
      }
    )()
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error
    logDatabaseConnectionFallback("song detail", error)
    return null
  }
}

export const getSongsPage = async ({
  search,
  page,
  pageSize = SONGS_PAGE_SIZE,
  sortKey,
  sortDirection,
  levelMin,
  levelMax,
}: SongsQuery): Promise<SongsResponse> => {
  const normalizedSearch = search.trim()
  const safePage = Number.isNaN(page) || page < 1 ? 1 : page
  const normalizedPageSize = clampPageSize(pageSize)
  const normalizedLevelRange = normalizeDisplayLevelRange(levelMin, levelMax)

  // GitHub ActionsなどでDATABASE_URLが未設定の場合は空データで返してビルドを継続する
  if (!isDatabaseConfigured) {
    return createEmptySongsResponse(normalizedPageSize)
  }

  const levelValueRange = displayRangeToValueRange(normalizedLevelRange?.min, normalizedLevelRange?.max)
  const whereSql = buildWhereSql(normalizedSearch, levelValueRange)
  const orderBy = buildSort(sortKey, sortDirection)

  const listKey = buildListKey({
    search: normalizedSearch,
    sortKey,
    sortDirection,
    page: safePage,
    pageSize: normalizedPageSize,
    levelMin: normalizedLevelRange?.min,
    levelMax: normalizedLevelRange?.max,
  })

  let data: SongSummary[]
  try {
    data = await unstable_cache(
      async () =>
        prisma.$queryRaw<SongSummary[]>(Prisma.sql`
          SELECT "gameSongId", "title", "artist", "youtubeUrl", "level"
          FROM "song"
          ${whereSql}
          ORDER BY ${orderBy}
          OFFSET ${(safePage - 1) * normalizedPageSize}
          LIMIT ${normalizedPageSize + 1}
        `),
      listKey,
      {
        tags: [SONGS_TAG],
        revalidate: false,
      }
    )()
  } catch (error) {
    if (!isDatabaseConnectionError(error)) throw error
    logDatabaseConnectionFallback("song list", error)
    return createEmptySongsResponse(normalizedPageSize)
  }
  const hasNext = data.length > normalizedPageSize
  const pageData = hasNext ? data.slice(0, normalizedPageSize) : data

  return {
    data: pageData,
    page: safePage,
    pageSize: normalizedPageSize,
    hasNext,
  }
}

export const getRandomSongs = async ({
  search,
  levelMin,
  levelMax,
  limit = RANDOM_SONG_COUNT,
}: RandomSongsQuery): Promise<SongsResponse> => {
  const normalizedSearch = search.trim()
  const normalizedLevelRange = normalizeDisplayLevelRange(levelMin, levelMax)
  const levelValueRange = displayRangeToValueRange(normalizedLevelRange?.min, normalizedLevelRange?.max)
  const normalizedLimit = clampPageSize(limit || RANDOM_SONG_COUNT)
  const searchVariants = buildSearchVariants(normalizedSearch)

  if (!isDatabaseConfigured) {
    return createEmptySongsResponse(normalizedLimit)
  }

  const where: Prisma.SongWhereInput = {
    ...(buildSearchFilter(normalizedSearch) ?? {}),
    ...(levelValueRange
      ? {
          levelValue: {
            gte: levelValueRange.minValue,
            lte: levelValueRange.maxValue,
          },
        }
      : {}),
  }

  const whereSql = buildWhereSql(normalizedSearch, levelValueRange)

  let data: SongSummary[]
  try {
    data = await prisma.$queryRaw<
      SongSummary[]
    >(Prisma.sql`
      SELECT "gameSongId", "title", "artist", "youtubeUrl", "level"
      FROM "song"
      ${whereSql}
      ORDER BY random()
      LIMIT ${normalizedLimit}
    `)
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      logDatabaseConnectionFallback("random songs", error)
      return createEmptySongsResponse(normalizedLimit)
    }

    // Fallback to in-memory shuffle if raw query fails for any reason.
    console.error("Random songs query failed, falling back to in-memory shuffle", {
      error,
      search: normalizedSearch,
      searchVariants,
      levelValueRange,
    })
    let candidates: SongSummary[]
    try {
      candidates = await prisma.song.findMany({
        select: {
          gameSongId: true,
          title: true,
          artist: true,
          youtubeUrl: true,
          level: true,
        },
        where,
      })
    } catch (fallbackError) {
      if (!isDatabaseConnectionError(fallbackError)) throw fallbackError
      logDatabaseConnectionFallback("random songs fallback", fallbackError)
      return createEmptySongsResponse(normalizedLimit)
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    data = candidates.slice(0, normalizedLimit)
  }

  return {
    data,
    page: 1,
    pageSize: normalizedLimit,
    hasNext: false,
  }
}

export const isSupportedSortKey = (value: string | null): value is SongSortKey =>
  SONG_SORT_KEYS.includes(value as SongSortKey)

export const revalidateSongsCache = () => {
  revalidateTag(SONGS_TAG, 'max')
}

export const revalidateSongCache = (gameSongId: string) => {
  revalidateTag(buildSongDetailTag(gameSongId), 'max')
}
