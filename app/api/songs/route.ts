import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 200
const SORT_KEYS = ["id", "title", "artist", "level"] as const
type SortKey = (typeof SORT_KEYS)[number]
type SortDirection = "asc" | "desc"

const parseLevel = (value: string | null) => {
  const match = value?.trim().match(/^([0-9]+(?:\.[0-9]+)?)([+-])?$/)
  if (!match) return null
  const base = parseFloat(match[1])
  const modifier = match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0
  return { base, modifier }
}

const compareLevels = (left: { base: number; modifier: number }, right: { base: number; modifier: number }) => {
  if (left.base !== right.base) return left.base - right.base
  const modifierOrder = [-1, 0, 1]
  return modifierOrder.indexOf(left.modifier) - modifierOrder.indexOf(right.modifier)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const search = searchParams.get("search")?.trim() ?? ""
  const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const sortKey = (searchParams.get("sortKey") as SortKey) ?? "id"
  const sortDirection = (searchParams.get("sortDir") as SortDirection) ?? "asc"
  const pageSizeRaw = Number.parseInt(searchParams.get("limit") ?? `${PAGE_SIZE_DEFAULT}`, 10)

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

  if (sortKey === "level") {
    const songs = await prisma.song.findMany({
      select: {
        id: true,
        title: true,
        artist: true,
        youtubeUrl: true,
        level: true,
      },
      where,
    })

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(page, totalPages)

    const sorted = songs.sort((a, b) => {
      const left = parseLevel(a.level)
      const right = parseLevel(b.level)

      if (!left && !right) return 0
      if (left && !right) return sortDirection === "asc" ? -1 : 1
      if (!left && right) return sortDirection === "asc" ? 1 : -1
      if (!left || !right) return 0

      return compareLevels(left, right) * (sortDirection === "asc" ? 1 : -1)
    })

    const sliced = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

    return NextResponse.json({
      data: sliced,
      total,
      page: safePage,
      totalPages,
      pageSize,
    })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)

  const data = await prisma.song.findMany({
    select: {
      id: true,
      title: true,
      artist: true,
      youtubeUrl: true,
      level: true,
    },
    where,
    orderBy: { [SORT_KEYS.includes(sortKey) ? sortKey : "id"]: sortDirection === "desc" ? "desc" : "asc" },
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
