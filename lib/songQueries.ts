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
} from "@/types/songs"

export const SONGS_TAG = "songs"
const SONG_DETAIL_TAG_PREFIX = "song-detail"
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7
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
  "song-list",
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
      ...(searchId !== null ? [{ id: searchId }] : []),
    ],
  } satisfies Prisma.SongWhereInput
}

const buildSort = (sortKey: SongSortKey, sortDirection: SongSortDirection) =>
  sortKey === "level"
    ? [
        {
          levelValue: {
            sort: sortDirection,
            nulls: (sortDirection === "asc" ? "last" : "first") as Prisma.NullsOrder,
          },
        },
        { id: sortDirection },
      ]
    : [
        {
          [sortKey]: sortDirection === "desc" ? "desc" : "asc",
        } satisfies Prisma.SongOrderByWithRelationInput,
      ]

const clampPageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), SONGS_PAGE_SIZE_MAX)

const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)

const buildSongDetailKey = (id: number) => [SONG_DETAIL_TAG_PREFIX, `id:${id}`]
const buildSongDetailTag = (id: number) => `${SONG_DETAIL_TAG_PREFIX}:${id}`

export const getSongById = async (id: number) => {
  if (!isDatabaseConfigured) return null

  return unstable_cache(
    async () => prisma.song.findUnique({ where: { id } }),
    buildSongDetailKey(id),
    {
      tags: [buildSongDetailTag(id)],
      revalidate: ONE_WEEK_SECONDS, // 7 days
    }
  )()
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
    return {
      data: [],
      page: 1,
      pageSize: normalizedPageSize,
      hasNext: false,
    }
  }

  const levelValueRange = displayRangeToValueRange(normalizedLevelRange?.min, normalizedLevelRange?.max)
  const where = {
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

  const data = await unstable_cache(
    async () =>
      prisma.song.findMany({
        select: {
          id: true,
          title: true,
          artist: true,
          youtubeUrl: true,
          level: true,
        },
        where,
        orderBy,
        skip: (safePage - 1) * normalizedPageSize,
        take: normalizedPageSize + 1,
      }),
    listKey,
    {
      tags: [SONGS_TAG],
      revalidate: ONE_WEEK_SECONDS,
    }
  )()
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
  const searchId = parseSearchId(normalizedSearch)

  if (!isDatabaseConfigured) {
    return {
      data: [],
      page: 1,
      pageSize: normalizedLimit,
      hasNext: false,
    }
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

  const whereSqlParts: Prisma.Sql[] = []
  if (searchVariants.length > 0) {
    const likeClauses = searchVariants.map((variant) => {
      const pattern = `%${variant}%`
      return Prisma.sql`("title" ILIKE ${pattern} OR "artist" ILIKE ${pattern})`
    })
    if (likeClauses.length > 0) {
      whereSqlParts.push(Prisma.sql`(${Prisma.join(likeClauses, " OR ")})`)
    }
  }
  if (searchId !== null) {
    whereSqlParts.push(Prisma.sql`"id" = ${searchId}`)
  }
  if (levelValueRange) {
    whereSqlParts.push(
      Prisma.sql`"levelValue" BETWEEN ${levelValueRange.minValue} AND ${levelValueRange.maxValue}`
    )
  }
  const whereSql =
    whereSqlParts.length > 0
      ? Prisma.sql`WHERE TRUE AND ${Prisma.join(whereSqlParts, " AND ")}`
      : Prisma.empty

  let data: Array<{ id: number; title: string; artist: string | null; youtubeUrl: string; level: string | null }>
  try {
    data = await prisma.$queryRaw<
      Array<{ id: number; title: string; artist: string | null; youtubeUrl: string; level: string | null }>
    >(Prisma.sql`
      SELECT "id", "title", "artist", "youtubeUrl", "level"
      FROM "Song"
      ${whereSql}
      ORDER BY random()
      LIMIT ${normalizedLimit}
    `)
  } catch (error) {
    // Fallback to in-memory shuffle if raw query fails for any reason.
    console.error("Random songs query failed, falling back to in-memory shuffle", {
      error,
      search: normalizedSearch,
      searchVariants,
      levelValueRange,
    })
    const candidates = await prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: true,
        youtubeUrl: true,
        level: true,
      },
      where,
    })
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

export const revalidateSongCache = (id: number) => {
  revalidateTag(buildSongDetailTag(id), 'max')
}
