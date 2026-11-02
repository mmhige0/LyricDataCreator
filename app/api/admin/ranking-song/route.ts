import { prisma } from '@/lib/db'
import { endpoint, json, requireAdmin } from '@/lib/submissions/http'
import { findRankingSong } from '@/lib/submissions/registration'

export const runtime = 'nodejs'
export async function GET(request: Request) {
  return endpoint(async () => {
    requireAdmin(request)
    const gameSongId = new URL(request.url).searchParams.get('gameSongId') ?? ''
    const rankingSong = await findRankingSong(gameSongId)
    const publicSong = await prisma.song.findUnique({ where: { gameSongId }, select: { gameSongId: true, title: true, artist: true, level: true } })
    return json({ gameSongId, rankingSong, publicSong })
  })
}
