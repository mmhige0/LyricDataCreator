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
    const status = params.get('status')
    if (status && !['pending', 'publishing', 'rejected'].includes(status)) throw new SubmissionError(400, '状態が不正です。')
    const rows = await prisma.chartSubmission.findMany({
      where: { ...(status ? { status } : {}), ...(search ? { OR: [
        { title: { contains: search, mode: 'insensitive' } }, { artist: { contains: search, mode: 'insensitive' } }, { gameSongId: { contains: search } },
      ] } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * 20, take: 21,
      select: { id: true, title: true, artist: true, creatorName: true, status: true, revision: true, updatedAt: true, gameSongId: true, level: true },
    })
    const numbers = rows.slice(0, 20).flatMap(row => row.gameSongId ? [row.gameSongId] : [])
    const groups = numbers.length ? await prisma.chartSubmission.groupBy({ by: ['gameSongId'], where: { gameSongId: { in: numbers } }, _count: { _all: true } }) : []
    const counts = new Map(groups.map(group => [group.gameSongId, group._count._all]))
    return json({ submissions: rows.slice(0, 20).map(row => ({ ...row, duplicateCount: row.gameSongId ? (counts.get(row.gameSongId) ?? 1) - 1 : 0 })), page, hasNext: rows.length > 20 })
  })
}
