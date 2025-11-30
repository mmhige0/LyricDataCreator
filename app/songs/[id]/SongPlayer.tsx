"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ScoreEntry } from "@/lib/types"
import { AppHeader } from "@/components/AppHeader"
import { TypingGameContent } from "@/components/TypingGameContent"
import { CreditsSection } from "@/components/CreditsSection"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SongPlayerProps {
  song: {
    id: number
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
      <AppHeader title="Song Typing Theater" subtitle="プレイ" songTitle={song.title} />

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 mt-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/songs")}>
          曲一覧に戻る
        </Button>
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

      <CreditsSection />
    </div>
  )
}
