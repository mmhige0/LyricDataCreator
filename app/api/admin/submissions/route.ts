import { prisma } from '@/lib/db'
import { checkId, endpoint, json, requireAdmin } from '@/lib/submissions/http'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  return endpoint(async () => {
    requireAdmin(request)
    const cursor = new URL(request.url).searchParams.get('cursor')
    if (cursor) checkId(cursor)
    const rows = await prisma.chartSubmission.findMany({
      where: { status: { in: ['pending', 'publishing'] } },
      orderBy: { id: 'asc' }, take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, title: true, creatorName: true, status: true, revision: true, updatedAt: true, gameSongId: true },
    })
    return json({ submissions: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null })
  })
}
