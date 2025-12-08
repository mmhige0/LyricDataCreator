import { NextResponse } from "next/server"
import { getSongsPage, isSupportedSortKey } from "@/lib/songQueries"
import { SONGS_PAGE_SIZE, SONGS_PAGE_SIZE_MAX, type SongSortDirection, type SongSortKey } from "@/types/songs"

const clampPageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), SONGS_PAGE_SIZE_MAX)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.trim() ?? ""
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const sortKeyParam = (searchParams.get("sortKey") as SongSortKey | null) ?? "id"
  const sortDirectionParam = (searchParams.get("sortDir") as SongSortDirection | null) ?? "desc"
  const pageSizeRaw = Number.parseInt(searchParams.get("limit") ?? `${SONGS_PAGE_SIZE}`, 10)
  const levelMinRaw = Number.parseInt(searchParams.get("levelMin") ?? "", 10)
  const levelMaxRaw = Number.parseInt(searchParams.get("levelMax") ?? "", 10)

  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSize = clampPageSize(pageSizeRaw)
  const sortKey: SongSortKey = isSupportedSortKey(sortKeyParam) ? sortKeyParam : "id"
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
