import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { getSongById } from "@/lib/songQueries"
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

export default async function SongPage({ params }: SongPageProps) {
  const resolvedParams = await params
  const songId = Number(resolvedParams.id)
  if (!Number.isFinite(songId)) {
    notFound()
  }

  const song = await getSongById(songId)

  if (!song) {
    notFound()
  }

  const scoreEntries = parseScoreEntries(song.scoreEntries)

  return (
    <SongPlayer
      song={{
        id: songId,
        title: song.title,
        artist: song.artist,
        youtubeUrl: song.youtubeUrl,
        level: song.level,
        scoreEntries,
      }}
    />
  )
}
