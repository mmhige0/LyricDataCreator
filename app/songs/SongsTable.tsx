"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  LEVEL_DISPLAY_MAX,
  LEVEL_DISPLAY_MIN,
  normalizeDisplayLevelRange,
  parseLevelValue,
} from "@/lib/levels"
import { extractVideoId } from "@/lib/youtubeUtils"
import {
  SONGS_PAGE_SIZE,
  type SongSortDirection,
  type SongSortKey,
  type SongsResponse,
} from "@/types/songs"

type SongsKey = [
  "songs",
  {
    search: string
    page: number
    sortKey: SongSortKey
    sortDirection: SongSortDirection
    levelMin: number | null
    levelMax: number | null
  },
]

const isSameKey = (a: SongsKey, b: SongsKey) =>
  a[0] === b[0] &&
  a[1].search === b[1].search &&
  a[1].page === b[1].page &&
  a[1].sortKey === b[1].sortKey &&
  a[1].sortDirection === b[1].sortDirection &&
  a[1].levelMin === b[1].levelMin &&
  a[1].levelMax === b[1].levelMax

interface SongsTableProps {
  initialData?: SongsResponse
  initialSortKey?: SongSortKey
  initialSortDirection?: SongSortDirection
}

const buildSongsKey = (params: SongsKey[1]): SongsKey => [
  "songs",
  {
    search: params.search.trim(),
    page: params.page,
    sortKey: params.sortKey,
    sortDirection: params.sortDirection,
    levelMin: params.levelMin,
    levelMax: params.levelMax,
  },
]

const RANDOM_SONG_COUNT = 10
const SORT_OPTIONS: Array<{ key: SongSortKey; label: string }> = [
  { key: "id", label: "No." },
  { key: "title", label: "曲名" },
  { key: "artist", label: "アーティスト" },
  { key: "level", label: "Lv." },
]

const getYouTubeThumbnailUrl = (youtubeUrl: string) => {
  const videoId = extractVideoId(youtubeUrl)
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ""
}

const fetchSongs = async ([, params]: SongsKey): Promise<SongsResponse> => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(SONGS_PAGE_SIZE),
    sortKey: params.sortKey,
    sortDir: params.sortDirection,
  })

  if (params.search) {
    searchParams.set("search", params.search)
  }
  if (params.levelMin !== null) {
    searchParams.set("levelMin", String(params.levelMin))
  }
  if (params.levelMax !== null) {
    searchParams.set("levelMax", String(params.levelMax))
  }

  const response = await fetch(`/api/songs?${searchParams.toString()}`)

  if (!response.ok) {
    const error = new Error(`Failed to load songs: ${response.status}`)
    throw error
  }

  return (await response.json()) as SongsResponse
}

export function SongsTable({
  initialData,
  initialSortKey = "id",
  initialSortDirection = "desc",
}: SongsTableProps) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(initialData?.page ?? 1)
  const [sortKey, setSortKey] = useState<SongSortKey>(initialSortKey)
  const [sortDirection, setSortDirection] = useState<SongSortDirection>(initialSortDirection)
  const [sliderMin, setSliderMin] = useState<number>(LEVEL_DISPLAY_MIN)
  const [sliderMax, setSliderMax] = useState<number>(LEVEL_DISPLAY_MAX)
  const [appliedLevelRange, setAppliedLevelRange] = useState<{ min: number; max: number } | null>(null)
  const sliderMinRef = useRef(sliderMin)
  const sliderMaxRef = useRef(sliderMax)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState<"min" | "max" | null>(null)
  const [randomSongs, setRandomSongs] = useState<SongsResponse | null>(null)
  const [randomLoading, setRandomLoading] = useState(false)
  const [randomError, setRandomError] = useState<string | null>(null)
  const [randomSorted, setRandomSorted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
      setRandomSongs(null)
      setRandomError(null)
      setRandomSorted(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const sliderRange = LEVEL_DISPLAY_MAX - LEVEL_DISPLAY_MIN
  const levelToPercent = useCallback(
    (value: number) => ((value - LEVEL_DISPLAY_MIN) / sliderRange) * 100,
    [sliderRange]
  )

  const normalizedSliderRange = useMemo(
    () =>
      normalizeDisplayLevelRange(sliderMin, sliderMax) ?? {
        min: LEVEL_DISPLAY_MIN,
        max: LEVEL_DISPLAY_MAX,
      },
    [sliderMax, sliderMin]
  )

  const songsKey = useMemo(
    () =>
      buildSongsKey({
        search,
        page,
        sortKey,
        sortDirection,
        levelMin: appliedLevelRange?.min ?? null,
        levelMax: appliedLevelRange?.max ?? null,
      }),
    [appliedLevelRange, page, search, sortDirection, sortKey]
  )

  const previousKeyRef = useRef<SongsKey>(songsKey)
  const [hideStaleRows, setHideStaleRows] = useState(false)
  const handleClearSearch = useCallback(() => {
    setSearchInput("")
    setSearch("")
    setRandomSongs(null)
    setRandomError(null)
    setRandomSorted(false)
    setPage(1)
  }, [])

  useEffect(() => {
    if (!isSameKey(previousKeyRef.current, songsKey)) {
      setHideStaleRows(true)
      previousKeyRef.current = songsKey
    }
  }, [songsKey])

  const shouldUseFallback =
    Boolean(initialData) &&
    search.trim() === "" &&
    page === (initialData?.page ?? 1) &&
    sortKey === initialSortKey &&
    sortDirection === initialSortDirection &&
    !appliedLevelRange

  const {
    data,
    error,
    isLoading,
    isValidating,
  } = useSWR<SongsResponse, Error>(songsKey, fetchSongs, {
    fallbackData: shouldUseFallback ? initialData : undefined,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorRetryCount: 2,
    errorRetryInterval: 1500,
  })

  useEffect(() => {
    if (data || error) {
      setHideStaleRows(false)
    }
  }, [data, error])

  const isRandomMode = randomLoading || Boolean(randomSongs)
  const activeData = randomSongs ?? data
  const hideRows = isRandomMode ? false : hideStaleRows
  const songs = hideRows ? [] : activeData?.data ?? []
  const pageSizeForDisplay = isRandomMode ? songs.length || 1 : activeData?.pageSize ?? SONGS_PAGE_SIZE
  const hasNext = hideRows ? false : isRandomMode ? false : activeData?.hasNext ?? false
  const currentPage = activeData?.page ?? page
  const baseLoading = isLoading || (!data && isValidating)
  const loading = isRandomMode ? randomLoading : baseLoading
  const showRetryableError = isRandomMode ? Boolean(randomError) : Boolean(error)
  const paginationDisabled = loading || isRandomMode
  const errorMessage =
    isRandomMode && randomError
      ? randomError
      : error?.message ?? "曲の読み込みに失敗しました"
  const displayStart = songs.length === 0 ? 0 : (currentPage - 1) * pageSizeForDisplay + 1
  const displayEnd = songs.length === 0 ? 0 : displayStart + songs.length - 1

  const sortSongList = useCallback(
    (list: SongsResponse["data"], key: SongSortKey, direction: SongSortDirection) => {
      const multiplier = direction === "asc" ? 1 : -1
      return [...list].sort((a, b) => {
        if (key === "id") {
          return (a.id - b.id) * multiplier
        }
        if (key === "level") {
          const levelValueA = parseLevelValue(a.level)
          const levelValueB = parseLevelValue(b.level)
          if (levelValueA !== null && levelValueB !== null) {
            return (levelValueA - levelValueB) * multiplier
          }
          if (levelValueA !== null) return -1 * multiplier
          if (levelValueB !== null) return 1 * multiplier
          const levelA = a.level ?? ""
          const levelB = b.level ?? ""
          return levelA.localeCompare(levelB, "ja") * multiplier
        }
        if (key === "artist") {
          const artistA = a.artist ?? ""
          const artistB = b.artist ?? ""
          return artistA.localeCompare(artistB, "ja") * multiplier
        }
        return a.title.localeCompare(b.title, "ja") * multiplier
      })
    },
    []
  )

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => {
        const nextDirection = prev === "asc" ? "desc" : "asc"
        if (randomSongs) {
          setRandomSorted(true)
          setRandomSongs((current) =>
            current
              ? {
                  ...current,
                  data: sortSongList(current.data, key as SongSortKey, nextDirection),
                }
              : current
          )
        }
        return nextDirection
      })
      setPage(1)
      return
    }
    setSortKey(key)
    const nextDirection = key === "id" ? "desc" : "asc"
    setSortDirection(nextDirection)
    if (randomSongs) {
      setRandomSorted(true)
      setRandomSongs((current) =>
        current
          ? {
              ...current,
              data: sortSongList(current.data, key as SongSortKey, nextDirection),
            }
          : current
      )
    }
    setPage(1)
  }

  const setSliderRange = useCallback((nextMin: number, nextMax: number) => {
    const normalized = normalizeDisplayLevelRange(nextMin, nextMax) ?? {
      min: LEVEL_DISPLAY_MIN,
      max: LEVEL_DISPLAY_MAX,
    }
    sliderMinRef.current = normalized.min
    sliderMaxRef.current = normalized.max
    setSliderMin(normalized.min)
    setSliderMax(normalized.max)
  }, [])

  const applySliderRange = useCallback(() => {
    const normalized = normalizeDisplayLevelRange(sliderMinRef.current, sliderMaxRef.current) ?? null
    const nextRange =
      normalized &&
      (normalized.min !== LEVEL_DISPLAY_MIN || normalized.max !== LEVEL_DISPLAY_MAX)
        ? normalized
        : null
    setRandomSongs(null)
    setRandomError(null)
    setRandomSorted(false)
    setAppliedLevelRange(nextRange)
    setPage(1)
  }, [])

  const percentRange = useMemo(
    () => ({
      min: levelToPercent(normalizedSliderRange.min),
      max: levelToPercent(normalizedSliderRange.max),
    }),
    [levelToPercent, normalizedSliderRange.max, normalizedSliderRange.min]
  )

  const clearRandomSongs = useCallback(() => {
    setRandomSongs(null)
    setRandomError(null)
    setRandomSorted(false)
  }, [])

  const requestRandomSongs = useCallback(async () => {
    setRandomLoading(true)
    setRandomError(null)
    try {
      const params = new URLSearchParams({ limit: String(RANDOM_SONG_COUNT) })
      if (search.trim()) {
        params.set("search", search.trim())
      }
      if (appliedLevelRange?.min != null) {
        params.set("levelMin", String(appliedLevelRange.min))
      }
      if (appliedLevelRange?.max != null) {
        params.set("levelMax", String(appliedLevelRange.max))
      }

      const response = await fetch(`/api/songs/random?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`ランダム取得に失敗しました (${response.status})`)
      }
      const payload = (await response.json()) as SongsResponse
      setRandomSongs(payload)
      setRandomSorted(false)
      setHideStaleRows(false)
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "ランダム取得に失敗しました"
      setRandomError(message)
    } finally {
      setRandomLoading(false)
    }
  }, [appliedLevelRange, search])

  const positionToValue = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return null
      const ratio = (clientX - rect.left) / rect.width
      const clampedRatio = Math.min(Math.max(ratio, 0), 1)
      return Math.round(LEVEL_DISPLAY_MIN + clampedRatio * sliderRange)
    },
    [sliderRange]
  )

  const handleSliderPointerMove = (event: ReactPointerEvent) => {
    if (!dragging) return
    const value = positionToValue(event.clientX)
    if (value === null) return
    if (dragging === "min") {
      setSliderRange(value, sliderMaxRef.current)
    } else {
      setSliderRange(sliderMinRef.current, value)
    }
  }

  const handleSliderPointerUp = () => {
    if (!dragging) return
    setDragging(null)
    applySliderRange()
  }

  const handleTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const value = positionToValue(event.clientX)
    if (value === null) return
    const distanceToMin = Math.abs(value - normalizedSliderRange.min)
    const distanceToMax = Math.abs(value - normalizedSliderRange.max)
    if (distanceToMin <= distanceToMax) {
      setSliderRange(value, sliderMax)
      setDragging("min")
    } else {
      setSliderRange(sliderMin, value)
      setDragging("max")
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleThumbPointerDown = (event: ReactPointerEvent, target: "min" | "max") => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(target)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleRowNavigate = useCallback((id: number) => {
    router.push(`/songs/${id}`)
  }, [router])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-[440px]">
            <div className="relative">
              <Input
                placeholder="曲名やアーティスト名で検索"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="w-full bg-white pr-10 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-950"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800"
                  aria-label="検索をクリア"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 xl:max-w-[720px]">
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50/70 px-3 py-3 dark:bg-slate-800/40">
              <div className="flex flex-1 items-center gap-2 min-w-[260px]">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Lv.{normalizedSliderRange.min}</span>
                <div
                  className="relative h-2 w-full max-w-[280px] cursor-pointer select-none rounded-full bg-slate-200 dark:bg-slate-700"
                  ref={trackRef}
                  onPointerDown={handleTrackPointerDown}
                  onPointerMove={handleSliderPointerMove}
                  onPointerUp={handleSliderPointerUp}
                >
                  <div
                    className="absolute h-full rounded-full bg-blue-500/70 dark:bg-blue-400/70"
                    style={{
                      left: `${percentRange.min}%`,
                      width: `${Math.max(0, percentRange.max - percentRange.min)}%`,
                    }}
                  />
                  <button
                    type="button"
                    onPointerDown={(event) => handleThumbPointerDown(event, "min")}
                    onPointerMove={handleSliderPointerMove}
                    onPointerUp={handleSliderPointerUp}
                    className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 cursor-pointer rounded-full border border-slate-300 bg-white shadow-sm outline-none ring-2 ring-transparent transition hover:ring-blue-200 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                    style={{ left: `${percentRange.min}%` }}
                    aria-label="Lv.下限を変更"
                  />
                  <button
                    type="button"
                    onPointerDown={(event) => handleThumbPointerDown(event, "max")}
                    onPointerMove={handleSliderPointerMove}
                    onPointerUp={handleSliderPointerUp}
                    className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 cursor-pointer rounded-full border border-slate-300 bg-white shadow-sm outline-none ring-2 ring-transparent transition hover:ring-blue-200 focus-visible:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                    style={{ left: `${percentRange.max}%` }}
                    aria-label="Lv.上限を変更"
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Lv.{normalizedSliderRange.max}</span>
              </div>
            </div>
            {randomError && (
              <p className="text-right text-xs text-red-600 dark:text-red-400">{randomError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {SORT_OPTIONS.map(({ key, label }) => {
            const isActive = sortKey === key
            const showDirection = !isRandomMode || randomSorted
            const direction =
              isActive && showDirection ? (sortDirection === "asc" ? "↑" : "↓") : ""
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isRandomMode && !randomSorted
                    ? "border-slate-100 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    : isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {label}
                <span className="ml-1 text-[10px]">{direction}</span>
              </button>
            )
          })}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestRandomSongs}
              disabled={randomLoading || loading}
              className={`rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isRandomMode
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              ランダム
            </button>
            <button
              type="button"
              onClick={clearRandomSongs}
              disabled={randomLoading}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isRandomMode
                  ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  : "invisible"
              }`}
            >
              リセット
            </button>
          </div>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {displayStart}-{displayEnd} 件を表示
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {songs.map((song) => {
          const thumbnailUrl = getYouTubeThumbnailUrl(song.youtubeUrl)
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => handleRowNavigate(song.id)}
              className="group text-left"
            >
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="relative aspect-video overflow-hidden bg-slate-200 dark:bg-slate-800">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`${song.title}のYouTubeサムネイル`}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                      サムネイルなし
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm">
                    No.{song.id}
                  </div>
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-semibold text-slate-900 truncate dark:text-white">
                      {song.title}
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Lv.{song.level ?? "—"}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {song.artist ?? "—"}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        {loading && songs.length === 0 && (
          <>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="aspect-video animate-pulse bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {songs.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 py-12 text-center text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          条件に一致する曲がありません。
        </div>
      )}
      {showRetryableError && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 py-6 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          エラーが発生しました: {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || paginationDisabled}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            前へ
          </Button>
          <span className="text-xs">{currentPage}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || paginationDisabled}
            onClick={() => setPage((value) => value + 1)}
          >
            次へ
          </Button>
        </div>
        <div className="hidden text-xs text-slate-500 md:block">
          ページを移動してさらに表示
        </div>
      </div>
    </div>
  )
}
