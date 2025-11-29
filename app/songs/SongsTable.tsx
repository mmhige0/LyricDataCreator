"use client"

import Link from "next/link"
import type { Song } from "@prisma/client"
import { Button } from "@/components/ui/button"

interface SongsTableProps {
  songs: Song[]
}

export function SongsTable({ songs }: SongsTableProps) {
  if (songs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-8 text-center text-slate-500 dark:text-slate-300">
        登録された曲がありません。
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {songs.map((song) => (
        <div
          key={song.id}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                {song.title}
              </h2>
              {song.artist && <p className="text-sm text-slate-600 dark:text-slate-300">{song.artist}</p>}
            </div>
            {song.level && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                {song.level}
              </span>
            )}
          </div>

          <div className="text-sm text-slate-600 dark:text-slate-300 break-all">
            <span className="font-semibold">YouTube:</span>{" "}
            <Link
              href={song.youtubeUrl}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {song.youtubeUrl}
            </Link>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/songs/${song.id}`} prefetch={false}>
                プレイ
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
