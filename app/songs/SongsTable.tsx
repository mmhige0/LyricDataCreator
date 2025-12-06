"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  },
]

const isSameKey = (a: SongsKey, b: SongsKey) =>
  a[0] === b[0] &&
  a[1].search === b[1].search &&
  a[1].page === b[1].page &&
  a[1].sortKey === b[1].sortKey &&
  a[1].sortDirection === b[1].sortDirection

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
  },
]

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
  const prefetchedSongIdsRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const songsKey = useMemo(
    () =>
      buildSongsKey({
        search,
        page,
        sortKey,
        sortDirection,
      }),
    [page, search, sortDirection, sortKey]
  )

  const previousKeyRef = useRef<SongsKey>(songsKey)
  const [hideStaleRows, setHideStaleRows] = useState(false)

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
    sortDirection === initialSortDirection

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

  useEffect(() => {
    if (data && page > data.totalPages) {
      setPage(data.totalPages)
    }
  }, [data, page])

  const songs = hideStaleRows ? [] : data?.data ?? []
  const total = hideStaleRows ? 0 : data?.total ?? 0
  const totalPages = hideStaleRows ? 1 : data?.totalPages ?? 1
  const currentPage = data?.page ?? page
  const loading = isLoading || (!data && isValidating)
  const showRetryableError = Boolean(error)

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      setPage(1)
      return
    }
    setSortKey(key)
    setSortDirection(key === "id" ? "desc" : "asc")
    setPage(1)
  }

  const handleRowNavigate = useCallback((id: number) => {
    router.push(`/songs/${id}`)
  }, [router])

  const prefetchSongPage = useCallback((id: number) => {
    if (prefetchedSongIdsRef.current.has(id)) return
    prefetchedSongIdsRef.current.add(id)
    router.prefetch(`/songs/${id}`)
  }, [router])

  useEffect(() => {
    if (!data?.data?.length) return
    // Prefetch song pages for currently visible rows to make navigation feel instant.
    data.data.forEach((song) => prefetchSongPage(song.id))
  }, [data?.data, prefetchSongPage])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm md:flex-row md:items-center md:justify-start">
        <div className="w-full md:w-80">
          <Input
            placeholder="曲名やアーティスト名で検索"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 dark:bg-slate-900/70">
              <tr>
                {[
                  { key: "id", label: "No.", className: "w-[96px]" },
                  { key: "title", label: "曲名", className: "w-[320px]" },
                  { key: "artist", label: "アーティスト名", className: "w-[320px]" },
                  { key: "level", label: "Lv.", className: "w-[80px]" },
                ].map(({ key, label, className }) => {
                  const isActive = sortKey === key
                  const direction = isActive ? (sortDirection === "asc" ? "↑" : "↓") : ""

                  return (
                    <th
                      key={key}
                      scope="col"
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 ${className ?? ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(key as typeof sortKey)}
                        className="flex items-center gap-1 text-left hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <span>{label}</span>
                        <span className="text-[10px] leading-none">{direction}</span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {songs.map((song) => (
                <tr
                  key={song.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowNavigate(song.id)}
                  onMouseEnter={() => prefetchSongPage(song.id)}
                  onFocus={() => prefetchSongPage(song.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleRowNavigate(song.id)
                    }
                  }}
                  className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{song.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white truncate">{song.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 truncate">
                    {song.artist ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {song.level ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {songs.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">条件に一致する曲がありません。</div>
        )}
        {loading && (
          <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">読み込み中...</div>
        )}
        {showRetryableError && (
          <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
            エラーが発生しました: {error?.message ?? "曲の読み込みに失敗しました"}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <span>
          {total} 曲中{" "}
          {total === 0
            ? 0
            : (currentPage - 1) * SONGS_PAGE_SIZE + 1}-{total === 0 ? 0 : Math.min(currentPage * SONGS_PAGE_SIZE, total)} 件を表示
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            前へ
          </Button>
          <span className="text-xs">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            次へ
          </Button>
        </div>
      </div>
    </div>
  )
}
