"use client"

import { useRouter } from "next/navigation"
import type { ScoreEntry } from "@/lib/types"
import { AppHeader } from "@/components/AppHeader"
import { TypingGameContent } from "@/components/TypingGameContent"
import { CreditsSection } from "@/components/CreditsSection"
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Song Typing Theater" songTitle={song.title} titleHref="/" />

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
