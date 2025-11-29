"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

export type SongSummary = {
  id: number
  title: string
  artist: string | null
  youtubeUrl: string
  level: string | null
}

interface SongsTableProps {
  songs: SongSummary[]
}

export function SongsTable({ songs }: SongsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<"id" | "title" | "artist" | "level">("id")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const parseLevel = (value: string | null) => {
    const match = value?.trim().match(/^([0-9]+(?:\.[0-9]+)?)([+-])?$/)
    if (!match) return null
    const base = parseFloat(match[1])
    const modifier = match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0
    return { base, modifier }
  }

  const compareLevels = (left: { base: number; modifier: number }, right: { base: number; modifier: number }) => {
    if (left.base !== right.base) return left.base - right.base
    const modifierOrder = [-1, 0, 1]
    return modifierOrder.indexOf(left.modifier) - modifierOrder.indexOf(right.modifier)
  }

  const filteredSongs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return songs
      .filter((song) => {
        if (!normalizedSearch) return true
        return (
          song.title.toLowerCase().includes(normalizedSearch) ||
          song.artist?.toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1

      if (sortKey === "id") {
        return (a.id - b.id) * multiplier
      }

      if (sortKey === "level") {
        const levelA = parseLevel(a.level)
        const levelB = parseLevel(b.level)

        if (!levelA && !levelB) return 0
        if (levelA && !levelB) return -1
        if (!levelA && levelB) return 1
        if (!levelA || !levelB) return 0

        return compareLevels(levelA, levelB) * multiplier
      }

      const left = (a[sortKey] ?? "").toString().toLowerCase()
      const right = (b[sortKey] ?? "").toString().toLowerCase()
      if (left < right) return -1 * multiplier
      if (left > right) return 1 * multiplier
      return 0
    })
  }, [search, songs, sortDirection, sortKey])

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

  if (songs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-8 text-center text-slate-500 dark:text-slate-300">
        登録された曲がありません。
      </div>
    )
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
              {filteredSongs.map((song) => (
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
        {filteredSongs.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-slate-600 dark:text-slate-300">条件に一致する曲がありません。</div>
        )}
      </div>
    </div>
  )
}
