import { NextResponse } from "next/server"
import { getRandomSongs } from "@/lib/songQueries"
import { SONGS_PAGE_SIZE_MAX } from "@/types/songs"

const clampLimit = (limit: number) => Math.min(Math.max(limit, 1), SONGS_PAGE_SIZE_MAX)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.trim() ?? ""
  const levelMinRaw = Number.parseInt(searchParams.get("levelMin") ?? "", 10)
  const levelMaxRaw = Number.parseInt(searchParams.get("levelMax") ?? "", 10)
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "", 10)

  const levelMin = Number.isNaN(levelMinRaw) ? null : levelMinRaw
  const levelMax = Number.isNaN(levelMaxRaw) ? null : levelMaxRaw
  const limit = Number.isNaN(limitRaw) ? undefined : clampLimit(limitRaw)

  const payload = await getRandomSongs({
    search,
    levelMin,
    levelMax,
    limit,
  })

  return NextResponse.json(payload)
}
