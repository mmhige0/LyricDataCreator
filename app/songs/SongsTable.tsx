"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export type SongSummary = {
  id: number
  title: string
  artist: string | null
  youtubeUrl: string
  level: string | null
}

type SongsResponse = {
  data: SongSummary[]
  total: number
  page: number
  totalPages: number
  pageSize: number
}

const PAGE_SIZE = 50

type SortKey = "id" | "title" | "artist" | "level"
type SortDirection = "asc" | "desc"

interface SongsTableProps {
  initialData?: SongsResponse
  initialSortKey?: SortKey
  initialSortDirection?: SortDirection
}

export function SongsTable({
  initialData,
  initialSortKey = "id",
  initialSortDirection = "asc",
}: SongsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(initialData?.page ?? 1)
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection)
  const [songs, setSongs] = useState<SongSummary[]>(initialData?.data ?? [])
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [totalPages, setTotalPages] = useState(initialData?.totalPages ?? 1)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const shouldUseInitial =
      Boolean(initialData) &&
      search.trim() === "" &&
      page === (initialData?.page ?? 1) &&
      sortKey === initialSortKey &&
      sortDirection === initialSortDirection

    if (shouldUseInitial) {
      setSongs(initialData!.data)
      setTotal(initialData!.total)
      setTotalPages(initialData!.totalPages)
      setLoading(false)
      setError(null)
      return () => controller.abort()
    }

    const fetchSongs = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          sortKey,
          sortDir: sortDirection,
        })
        if (search.trim()) {
          params.set("search", search.trim())
        }

        const response = await fetch(`/api/songs?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Failed to load songs: ${response.status}`)
        }
        const payload = (await response.json()) as SongsResponse
        setSongs(payload.data)
        setTotal(payload.total)
        setTotalPages(payload.totalPages)
        if (page !== payload.page) {
          setPage(payload.page)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "曲の読み込みに失敗しました")
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchSongs()

    return () => controller.abort()
  }, [initialData, initialSortDirection, initialSortKey, page, search, sortDirection, sortKey])

  useEffect(() => {
    setPage(1)
  }, [search, sortKey, sortDirection])

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      return
    }
    setSortKey(key)
    setSortDirection(key === "id" ? "desc" : "asc")
  }

  const handleRowNavigate = (id: number) => {
    router.push(`/songs/${id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm md:flex-row md:items-center md:justify-start">
        <div className="w-full md:w-80">
          <Input
            placeholder="タイトルやアーティストで検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
                  { key: "id", label: "ID" },
                  { key: "title", label: "曲" },
                  { key: "artist", label: "アーティスト" },
                  { key: "level", label: "Lv." },
                ].map(({ key, label }) => {
                  const isActive = sortKey === key
                  const direction = isActive ? (sortDirection === "asc" ? "↑" : "↓") : ""

                  return (
                    <th
                      key={key}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
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
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleRowNavigate(song.id)
                    }
                  }}
                  className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{song.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{song.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
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
        {error && (
          <div className="px-4 py-6 text-center text-sm text-red-600 dark:text-red-400">
            エラーが発生しました: {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <span>
          {total} 曲中{" "}
          {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{total === 0 ? 0 : Math.min(page * PAGE_SIZE, total)} 件を表示
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            前へ
          </Button>
          <span className="text-xs">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            次へ
          </Button>
        </div>
      </div>
    </div>
  )
}
