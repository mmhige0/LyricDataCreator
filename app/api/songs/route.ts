import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { GAME_SONG_ID } from "@/lib/submissions/validation"
import { parseLevelValue } from "@/lib/levels"
import { getSongsPage, isSupportedSortKey, revalidateSongCache, revalidateSongsCache } from "@/lib/songQueries"
import { SONGS_PAGE_SIZE, SONGS_PAGE_SIZE_MAX, type SongSortDirection, type SongSortKey } from "@/types/songs"

const clampPageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), SONGS_PAGE_SIZE_MAX)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.trim() ?? ""
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const sortKeyParam = (searchParams.get("sortKey") as SongSortKey | null) ?? "gameSongId"
  const sortDirectionParam = (searchParams.get("sortDir") as SongSortDirection | null) ?? "desc"
  const pageSizeRaw = Number.parseInt(searchParams.get("limit") ?? `${SONGS_PAGE_SIZE}`, 10)
  const levelMinRaw = Number.parseInt(searchParams.get("levelMin") ?? "", 10)
  const levelMaxRaw = Number.parseInt(searchParams.get("levelMax") ?? "", 10)

  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSize = clampPageSize(pageSizeRaw)
  const sortKey: SongSortKey = isSupportedSortKey(sortKeyParam) ? sortKeyParam : "gameSongId"
  const sortDirection: SongSortDirection = sortDirectionParam === "desc" ? "desc" : "asc"
  const levelMin = Number.isNaN(levelMinRaw) ? null : levelMinRaw
  const levelMax = Number.isNaN(levelMaxRaw) ? null : levelMaxRaw

  const payload = await getSongsPage({
    search,
    page,
    pageSize,
    sortKey,
    sortDirection,
    levelMin,
    levelMax,
  })

  return NextResponse.json(payload)
}

type SongLevelUpdate = {
  gameSongId: string
  level: string
  levelValue: number
}

type UpdateResult = {
  gameSongId: string
  title: string
  artist: string | null
  youtubeUrl: string
  level: string | null
}

type UpdateError = {
  gameSongId: string
  error: string
}

const IMPORT_SECRET_HEADER = "x-import-secret"

export async function PATCH(request: Request) {
  const secret = process.env.IMPORT_SECRET
  if (!secret) {
    return NextResponse.json({ error: "IMPORT_SECRET is not set on the server" }, { status: 500 })
  }

  const providedSecret = request.headers.get(IMPORT_SECRET_HEADER)
  if (providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
  }

  const { songs } = body as { songs?: unknown }

  if (!Array.isArray(songs)) {
    return NextResponse.json({ error: "songs must be an array" }, { status: 400 })
  }

  if (songs.length === 0) {
    return NextResponse.json({ error: "songs array cannot be empty" }, { status: 400 })
  }

  const updates: SongLevelUpdate[] = []
  const validationErrors: UpdateError[] = []

  for (const item of songs) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    const { gameSongId, level } = item as { gameSongId?: unknown; level?: unknown }

    if (typeof gameSongId !== "string" || !GAME_SONG_ID.test(gameSongId)) {
      validationErrors.push({ gameSongId: String(gameSongId ?? ""), error: "Invalid gameSongId" })
      continue
    }

    if (typeof level !== "string") {
      validationErrors.push({ gameSongId, error: "level must be a string" })
      continue
    }

    const levelValue = parseLevelValue(level)
    if (levelValue === null) {
      validationErrors.push({ gameSongId, error: "Invalid level format" })
      continue
    }

    updates.push({ gameSongId, level, levelValue })
  }

  if (updates.length === 0) {
    return NextResponse.json({ updated: [], errors: validationErrors })
  }

  const ids = updates.map((u) => u.gameSongId)
  const existingSongs = await prisma.song.findMany({
    where: { gameSongId: { in: ids } },
    select: { gameSongId: true },
  })
  const existingIds = new Set(existingSongs.map((s) => s.gameSongId))

  const validUpdates = updates.filter((u) => existingIds.has(u.gameSongId))
  const notFoundErrors: UpdateError[] = updates
    .filter((u) => !existingIds.has(u.gameSongId))
    .map((u) => ({ gameSongId: u.gameSongId, error: "Song not found" }))

  const errors: UpdateError[] = [...validationErrors, ...notFoundErrors]

  if (validUpdates.length === 0) {
    return NextResponse.json({ updated: [], errors })
  }

  // Build bulk UPDATE query with CASE expressions using parameterized queries
  const levelCases = validUpdates.map((u) => Prisma.sql`WHEN ${u.gameSongId} THEN ${u.level}`)
  const levelValueCases = validUpdates.map((u) => Prisma.sql`WHEN ${u.gameSongId} THEN ${u.levelValue}`)
  const idList = validUpdates.map((u) => u.gameSongId)

  const updated = await prisma.$queryRaw<UpdateResult[]>`
    UPDATE "song"
    SET
      "level" = CASE "gameSongId" ${Prisma.join(levelCases, " ")} END,
      "levelValue" = (CASE "gameSongId" ${Prisma.join(levelValueCases, " ")} END)::smallint
    WHERE "gameSongId" IN (${Prisma.join(idList)})
    RETURNING "gameSongId", "title", "artist", "youtubeUrl", "level"
  `

  revalidateSongsCache()
  for (const song of updated) revalidateSongCache(song.gameSongId)

  return NextResponse.json({ updated, errors })
}
