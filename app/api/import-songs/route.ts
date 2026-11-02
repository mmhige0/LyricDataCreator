import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseScoreTxt } from '@/lib/scoreFormat'
import { GAME_SONG_ID } from "@/lib/submissions/validation"
import { parseLevelValue } from '@/lib/levels'
import { revalidateSongCache, revalidateSongsCache } from '@/lib/songQueries'

type ImportSongInput = {
  gameSongId: string
  title: string
  youtubeUrl: string
  artist?: string
  level?: string
  txtContent: string
}

const IMPORT_SECRET_HEADER = 'x-import-secret'

const unauthorized = (message: string) => NextResponse.json({ error: message }, { status: 401 })

export async function POST(request: Request) {
  const secret = process.env.IMPORT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'IMPORT_SECRET is not set on the server' }, { status: 500 })
  }

  const providedSecret = request.headers.get(IMPORT_SECRET_HEADER)
  if (providedSecret !== secret) {
    return unauthorized('Unauthorized')
  }

  let body: { songs?: ImportSongInput[]; noUpdate?: boolean; truncate?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const songs = body.songs ?? []
  if (!Array.isArray(songs) || songs.length === 0) {
    return NextResponse.json({ error: 'songs array is required' }, { status: 400 })
  }

  const results: Array<Record<string, unknown>> = []
  try {
    if (body.truncate) {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "song";')
      results.push({ status: 'truncated' })
    }

    for (const song of songs) {
      const gameSongId = song.gameSongId
      if (typeof gameSongId !== "string" || !GAME_SONG_ID.test(gameSongId)) {
        results.push({ status: "error", message: "gameSongId must be a 3–8 digit string other than 000" })
        continue
      }
      const title = song.title?.trim()
      const youtubeUrl = song.youtubeUrl?.trim()
      if (!title || !youtubeUrl) {
        results.push({ title: title || '(missing)', status: 'error', message: 'title and youtubeUrl are required' })
        continue
      }

      let scoreEntries
      try {
        scoreEntries = parseScoreTxt(song.txtContent ?? '').scoreEntries
      } catch (error) {
        results.push({ title, status: 'error', message: error instanceof Error ? error.message : 'parse error' })
        continue
      }
      if (!scoreEntries.length) {
        results.push({ title, status: 'skipped', message: 'no entries' })
        continue
      }

      const levelValue = parseLevelValue(song.level)
      const existing = await prisma.song.findUnique({ where: { gameSongId } })

      if (existing && body.noUpdate) {
        results.push({ title, status: 'skipped', gameSongId: existing.gameSongId })
        continue
      }

      const data = {
        gameSongId,
        title,
        artist: song.artist ?? null,
        youtubeUrl,
        level: song.level ?? null,
        levelValue,
        scoreTxt: song.txtContent,
      }

      const saved = existing
        ? await prisma.song.update({ where: { gameSongId }, data })
        : await prisma.song.create({ data })

      // 個別ページのキャッシュを即時無効化
      revalidateSongCache(saved.gameSongId)
      results.push({ title, status: existing ? 'updated' : 'created', gameSongId: saved.gameSongId })
    }

    // 一覧と件数キャッシュをまとめて無効化
    revalidateSongsCache()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }

  return NextResponse.json({ results })
}
