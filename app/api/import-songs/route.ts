import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseLevelValue } from '@/lib/levels'
import { revalidateSongCache, revalidateSongsCache } from '@/lib/songQueries'

type ImportSongInput = {
  title: string
  youtubeUrl: string
  artist?: string
  level?: string
  txtContent: string
}

const IMPORT_SECRET_HEADER = 'x-import-secret'

const parseCsvTimestampLine = (line: string, index: number) => {
  const parts = line.split('/')
  if (parts.length !== 5) throw new Error(`${index + 1}行目: フォーマットが正しくありません`)
  const ts = Number.parseFloat(parts[4])
  if (Number.isNaN(ts)) throw new Error(`${index + 1}行目: タイムスタンプが正しくありません`)
  if (ts === 999.9) return null
  const lyrics = parts.slice(0, 4).map((p) => (p === '!' ? '' : p))
  return { id: `api_${index}_${Date.now()}`, timestamp: ts, lyrics }
}

const parseTxtToScoreEntries = (content: string) => {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('行数が不足しています')
  const entries = []
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue
    const parsed = parseCsvTimestampLine(line, i)
    if (!parsed) continue
    entries.push(parsed)
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp)
}

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
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "Song" RESTART IDENTITY CASCADE;')
      results.push({ status: 'truncated' })
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const song of songs) {
      const title = song.title?.trim()
      const youtubeUrl = song.youtubeUrl?.trim()
      if (!title || !youtubeUrl) {
        results.push({ title: title || '(missing)', status: 'error', message: 'title and youtubeUrl are required' })
        // eslint-disable-next-line no-continue
        continue
      }

      let scoreEntries
      try {
        scoreEntries = parseTxtToScoreEntries(song.txtContent ?? '')
      } catch (error) {
        results.push({ title, status: 'error', message: error instanceof Error ? error.message : 'parse error' })
        // eslint-disable-next-line no-continue
        continue
      }
      if (!scoreEntries.length) {
        results.push({ title, status: 'skipped', message: 'no entries' })
        // eslint-disable-next-line no-continue
        continue
      }

      const levelValue = parseLevelValue(song.level)
      const existing = await prisma.song.findFirst({ where: { title } })

      if (existing && body.noUpdate) {
        results.push({ title, status: 'skipped', id: existing.id })
        // eslint-disable-next-line no-continue
        continue
      }

      const data = {
        title,
        artist: song.artist ?? null,
        youtubeUrl,
        level: song.level ?? null,
        levelValue,
        scoreEntries: JSON.stringify(scoreEntries),
      }

      const saved = existing
        ? await prisma.song.update({ where: { id: existing.id }, data })
        : await prisma.song.create({ data })

      // 個別ページのキャッシュを即時無効化
      revalidateSongCache(saved.id)
      results.push({ title, status: existing ? 'updated' : 'created', id: saved.id })
    }

    // 一覧と件数キャッシュをまとめて無効化
    revalidateSongsCache()
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }

  return NextResponse.json({ results })
}
