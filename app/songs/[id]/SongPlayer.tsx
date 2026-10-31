"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import type { ScoreEntry } from "@/lib/types"
import { AppHeader } from "@/components/AppHeader"
import { PORTAL_ORIGIN } from "@/lib/site"
import { TypingGameContent } from "@/components/TypingGameContent"
import { cn } from "@/lib/utils"

interface SongPlayerProps {
  song: {
    gameSongId: string
    title: string
    artist: string | null
    youtubeUrl: string
    level: string | null
    scoreEntries: ScoreEntry[]
    notes: string
  }
}

export function SongPlayer({ song }: SongPlayerProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen page-shell">
      <AppHeader title="Song Typing Theater" songTitle={song.title} titleHref={PORTAL_ORIGIN} actions={<Button asChild variant="outline" size="sm"><Link href={`/editor?song=${encodeURIComponent(song.gameSongId)}`}>編集する</Link></Button>} />

      {song.notes && <section aria-label="補足情報" className="mx-auto my-4 max-w-5xl px-4">
        <details className="rounded-lg border bg-card p-4 text-card-foreground">
          <summary className="cursor-pointer text-sm font-medium">補足情報</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{song.notes}</p>
        </details>
      </section>}
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
