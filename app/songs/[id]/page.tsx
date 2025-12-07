import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { getSongById } from "@/lib/songQueries"
import { parseScoreEntries } from "@/lib/scoreSerialization"

const SongPlayer = dynamic(() => import("./SongPlayer").then((mod) => mod.SongPlayer), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white flex items-center justify-center">
      <div className="text-sm text-slate-600 dark:text-slate-200">プレイヤーを読み込み中...</div>
    </div>
  ),
})

export const revalidate = 60 * 60 * 24 * 7
export const runtime = "nodejs"

interface SongPageProps {
  params: { id: string }
}

export default async function SongPage({ params }: SongPageProps) {
  const songId = Number(params.id)
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
