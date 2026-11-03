import { prisma } from '@/lib/db'
import { checkId, endpoint, json, requireAdmin } from '@/lib/submissions/http'
import { findRankingSong } from '@/lib/submissions/registration'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  return endpoint(async () => {
    requireAdmin(request)
    const params = new URL(request.url).searchParams
    const gameSongId = params.get('gameSongId') ?? ''
    const submissionId = params.get('submissionId')
    if (submissionId) checkId(submissionId)
    const rankingSong = await findRankingSong(gameSongId)
    const publicSong = await prisma.song.findUnique({ where: { gameSongId }, select: { gameSongId: true, title: true, artist: true, level: true } })
    const otherSubmissions = await prisma.chartSubmission.findMany({ where: { gameSongId, ...(submissionId ? { id: { not: submissionId } } : {}) }, select: { id: true, title: true, status: true } })
    return json({ gameSongId, rankingSong, publicSong, otherSubmissions })
  })
}
