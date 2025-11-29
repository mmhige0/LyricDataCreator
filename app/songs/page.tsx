import { prisma } from "@/lib/db"
import { AppHeader } from "@/components/AppHeader"
import { SongsTable, type SongSummary } from "./SongsTable"

export const revalidate = 0
export const runtime = "nodejs"

export default async function SongsPage() {
  const songs = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      youtubeUrl: true,
      level: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Lyric Data Creator" subtitle="登録曲一覧" />
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 space-y-6">
        <SongsTable songs={songs} />
      </div>
    </div>
  )
}
