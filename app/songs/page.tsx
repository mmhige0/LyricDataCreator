import { prisma } from "@/lib/db"
import { AppHeader } from "@/components/AppHeader"
import { SongsTable, type SongSummary } from "./SongsTable"

export const revalidate = 0
export const runtime = "nodejs"

const PAGE_SIZE = 50

export default async function SongsPage() {
  const [data, total] = await Promise.all([
    prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: true,
        youtubeUrl: true,
        level: true,
      },
      orderBy: { id: "asc" },
      skip: 0,
      take: PAGE_SIZE,
    }) as Promise<SongSummary[]>,
    prisma.song.count(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Lyric Data Creator" subtitle="曲一覧" />
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 space-y-6">
        <SongsTable
          initialData={{
            data,
            total,
            page: 1,
            totalPages,
            pageSize: PAGE_SIZE,
          }}
          initialSortKey="id"
          initialSortDirection="asc"
        />
      </div>
    </div>
  )
}
