import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { endpoint, json, requireAdmin } from '@/lib/submissions/http'
import { SubmissionError } from '@/lib/submissions/validation'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  return endpoint(async () => {
    requireAdmin(request)
    const params = new URL(request.url).searchParams
    const page = Number(params.get('page') ?? '1')
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new SubmissionError(400, 'ページ番号が不正です。')
    const search = (params.get('q') ?? '').trim().slice(0, 200)
    if (params.get('view') === 'published') {
      const pattern = `%${search}%`
      const songs = await prisma.$queryRaw<Array<{ gameSongId: string; title: string; artist: string | null; level: string | null; creatorName: string | null; updatedAt: Date }>>(Prisma.sql`
        SELECT "gameSongId", title, artist, level, "creatorName", "updatedAt" FROM song
        WHERE "gameSongId" ILIKE ${pattern} OR title ILIKE ${pattern} OR artist ILIKE ${pattern}
        ORDER BY "gameSongId"::bigint, "gameSongId" COLLATE "C"
        LIMIT 21 OFFSET ${(page - 1) * 20}
      `)
      return json({ songs: songs.slice(0, 20), page, hasNext: songs.length > 20 })
    }
    const status = params.get('status')
    if (status && !['pending', 'publishing', 'rejected'].includes(status)) throw new SubmissionError(400, '状態が不正です。')
    const rows = await prisma.chartSubmission.findMany({
      where: { ...(status ? { status } : {}), ...(search ? { OR: [
        { title: { contains: search, mode: 'insensitive' } }, { artist: { contains: search, mode: 'insensitive' } }, { gameSongId: { contains: search } },
      ] } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 21,
      select: { id: true, title: true, artist: true, creatorName: true, status: true, revision: true, updatedAt: true, gameSongId: true, level: true },
    })
    return json({ submissions: rows.slice(0, 20), page, hasNext: rows.length > 20 })
  })
}
