"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ScoreEntry } from "@/lib/types"
import { AppHeader } from "@/components/AppHeader"
import { TypingGameContent } from "@/components/TypingGameContent"
import { cn } from "@/lib/utils"

interface SongPlayerProps {
  song: {
    id: string
    title: string
    artist: string | null
    youtubeUrl: string
    level: string | null
    scoreEntries: ScoreEntry[]
  }
}

export function SongPlayer({ song }: SongPlayerProps) {
  const router = useRouter()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white flex items-center justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-200">プレイヤーを読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Lyric Data Creator" subtitle="プレイ" songTitle={song.title} />

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6 space-y-6">
        <div className="rounded-xl border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">データベース</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white leading-tight">{song.title}</h1>
            {song.artist && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{song.artist}</p>}
          </div>
          <div className="flex items-center gap-3">
            {song.level && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                レベル: {song.level}
              </span>
            )}
          </div>
        </div>

        <div className={cn("pb-10")}>
          <TypingGameContent
            onClose={() => router.push("/songs")}
            showHeader={false}
            scoreEntries={song.scoreEntries}
            songTitle={song.title}
            youtubeUrl={song.youtubeUrl}
          />
        </div>
      </div>
    </div>
  )
}
