import { Prisma } from "@prisma/client"
import { revalidateTag, unstable_cache } from "next/cache"
import { prisma } from "@/lib/db"
import {
  SONG_SORT_KEYS,
  SONGS_PAGE_SIZE,
  SONGS_PAGE_SIZE_MAX,
  type SongSortDirection,
  type SongSortKey,
  type SongsResponse,
} from "@/types/songs"

export const SONGS_TAG = "songs"
export const SONGS_COUNT_TAG = "songs-count"
const SONG_DETAIL_TAG_PREFIX = "song-detail"
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

type SongsQuery = {
  search: string
  page: number
  pageSize?: number
  sortKey: SongSortKey
  sortDirection: SongSortDirection
}

const buildCountKey = (search: string) => ["song-count", search || "all"]

const convertKatakanaToHiragana = (text: string): string =>
  text.replace(/[\u30A1-\u30F6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))

const convertHiraganaToKatakana = (text: string): string =>
  text.replace(/[\u3041-\u3096]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))

const buildSearchVariants = (search: string) => {
  const hiragana = convertKatakanaToHiragana(search)
  const katakana = convertHiraganaToKatakana(search)
  return Array.from(new Set([search, hiragana, katakana])).filter((text) => text.length > 0)
}

const buildListKey = (params: {
  search: string
  sortKey: SongSortKey
  sortDirection: SongSortDirection
  page: number
  pageSize: number
}) => [
  "song-list",
  `q:${params.search || "all"}`,
  `sort:${params.sortKey}:${params.sortDirection}`,
  `page:${params.page}`,
  `size:${params.pageSize}`,
]

const buildSearchFilter = (search: string) => {
  const variants = buildSearchVariants(search)

  if (variants.length === 0) return undefined

  return {
    OR: variants.flatMap((variant) => [
      { title: { contains: variant, mode: "insensitive" as const } },
      { artist: { contains: variant, mode: "insensitive" as const } },
    ]),
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
}: SongsQuery): Promise<SongsResponse> => {
  const normalizedSearch = search.trim()
  const safePage = Number.isNaN(page) || page < 1 ? 1 : page
  const normalizedPageSize = clampPageSize(pageSize)

  // GitHub ActionsなどでDATABASE_URLが未設定の場合は空データで返してビルドを継続する
  if (!isDatabaseConfigured) {
    return {
      data: [],
      total: 0,
      page: 1,
      totalPages: 1,
      pageSize: normalizedPageSize,
    }
  }

  const where = buildSearchFilter(normalizedSearch)
  const orderBy = buildSort(sortKey, sortDirection)

  const countKey = buildCountKey(normalizedSearch)
  const total = await unstable_cache(
    async () => prisma.song.count({ where }),
    countKey,
    {
      tags: [SONGS_COUNT_TAG],
      revalidate: ONE_WEEK_SECONDS,
    }
  )()
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize))
  const pageToUse = Math.min(safePage, totalPages)

  const listKey = buildListKey({
    search: normalizedSearch,
    sortKey,
    sortDirection,
    page: pageToUse,
    pageSize: normalizedPageSize,
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
        skip: (pageToUse - 1) * normalizedPageSize,
        take: normalizedPageSize,
      }),
    listKey,
    {
      tags: [SONGS_TAG],
      revalidate: ONE_WEEK_SECONDS,
    }
  )()

  return {
    data,
    total,
    page: pageToUse,
    totalPages,
    pageSize: normalizedPageSize,
  }
}

export const isSupportedSortKey = (value: string | null): value is SongSortKey =>
  SONG_SORT_KEYS.includes(value as SongSortKey)

export const revalidateSongsCache = () => {
  revalidateTag(SONGS_TAG)
  revalidateTag(SONGS_COUNT_TAG)
}

export const revalidateSongCache = (id: number) => {
  revalidateTag(buildSongDetailTag(id))
}
