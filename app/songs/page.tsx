import { AppHeader } from "@/components/AppHeader"
import { getSongsPage } from "@/lib/songQueries"
import {
  SONGS_PAGE_SIZE,
  type SongSortDirection,
  type SongSortKey,
  type SongsResponse,
} from "@/types/songs"
import { SongsTable } from "./SongsTable"

export const revalidate = 180
export const runtime = "nodejs"

const INITIAL_SORT_KEY: SongSortKey = "id"
const INITIAL_SORT_DIRECTION: SongSortDirection = "desc"

export default async function SongsPage() {
  const initialData: SongsResponse = await getSongsPage({
    search: "",
    page: 1,
    pageSize: SONGS_PAGE_SIZE,
    sortKey: INITIAL_SORT_KEY,
    sortDirection: INITIAL_SORT_DIRECTION,
  })

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Song Typing Theater" titleHref="/" />
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-8 space-y-6">
        <SongsTable
          initialData={{
            data: initialData.data,
            page: initialData.page,
            pageSize: initialData.pageSize,
            hasNext: initialData.hasNext,
          }}
          initialSortKey={INITIAL_SORT_KEY}
          initialSortDirection={INITIAL_SORT_DIRECTION}
        />
      </div>
    </div>
  )
}
