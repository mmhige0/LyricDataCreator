"use client"

import { useRouter } from "next/navigation"
import type { ScoreEntry } from "@/lib/types"
import { AppHeader } from "@/components/AppHeader"
import { PORTAL_ORIGIN } from "@/lib/site"
import { TypingGameContent } from "@/components/TypingGameContent"
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
    <div className="min-h-screen page-shell">
      <AppHeader title="Song Typing Theater" songTitle={song.title} titleHref={PORTAL_ORIGIN} />

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
  )
}
