import type { Metadata } from "next"
import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { getSongByGameSongId } from "@/lib/songQueries"
import { GAME_SONG_ID } from "@/lib/submissions/validation"
import { parseScoreEntries } from "@/lib/scoreSerialization"

const SongPlayer = dynamic(() => import("./SongPlayer").then((mod) => mod.SongPlayer), {
  loading: () => (
    <div className="min-h-screen page-shell flex items-center justify-center">
      <div className="text-sm text-muted-foreground">プレイヤーを読み込み中...</div>
    </div>
  ),
})

export const revalidate = false
export const runtime = "nodejs"

interface SongPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const { id } = await params
  return {
    alternates: {
      canonical: `/songs/${encodeURIComponent(id)}/`,
    },
  }
}

export default async function SongPage({ params }: SongPageProps) {
  const resolvedParams = await params
  const gameSongId = resolvedParams.id
  if (!GAME_SONG_ID.test(gameSongId)) {
    notFound()
  }

  const song = await getSongByGameSongId(gameSongId)

  if (!song) {
    notFound()
  }

  const scoreEntries = parseScoreEntries(song.scoreEntries)

  return (
    <SongPlayer
      song={{
        gameSongId,
        title: song.title,
        artist: song.artist,
        youtubeUrl: song.youtubeUrl,
        level: song.level,
        scoreEntries,
        notes: song.notes,
      }}
    />
  )
}
