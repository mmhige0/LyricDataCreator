import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 200
const SORT_KEYS = ["id", "title", "artist", "level"] as const
type SortKey = (typeof SORT_KEYS)[number]
type SortDirection = "asc" | "desc"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.trim() ?? ""
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const sortKeyParam = (searchParams.get("sortKey") as SortKey) ?? "id"
  const sortDirection = (searchParams.get("sortDir") as SortDirection) ?? "asc"
  const pageSizeRaw = Number.parseInt(searchParams.get("limit") ?? `${PAGE_SIZE_DEFAULT}`, 10)
  const sortKey: SortKey = SORT_KEYS.includes(sortKeyParam) ? sortKeyParam : "id"

  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const pageSize = Math.min(Math.max(pageSizeRaw, 1), PAGE_SIZE_MAX)

  const where =
    search.length === 0
      ? undefined
      : {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { artist: { contains: search, mode: "insensitive" as const } },
          ],
        }

  const [total] = await Promise.all([prisma.song.count({ where })])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)

  const orderBy: Prisma.SongOrderByWithRelationInput[] =
    sortKey === "level"
      ? [
          {
            levelValue: {
              sort: sortDirection,
              nulls: sortDirection === "asc" ? "last" : "first",
            },
          },
          { id: sortDirection },
        ]
      : [
          {
            [sortKey]: sortDirection === "desc" ? "desc" : "asc",
          } satisfies Prisma.SongOrderByWithRelationInput,
        ]

  const data = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      youtubeUrl: true,
      level: true,
    },
    where,
    orderBy,
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  })

  return NextResponse.json({
    data,
    total,
    page: safePage,
    totalPages,
    pageSize,
  })
}
