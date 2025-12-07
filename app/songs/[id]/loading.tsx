import { AppHeader } from "@/components/AppHeader"

export default function SongLoading() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader title="Song Typing Theater" titleHref="/" />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-2 w-24 animate-pulse rounded-full bg-slate-300/80 dark:bg-slate-700/80" />
          <div className="text-sm text-slate-700 dark:text-slate-200">曲を読み込み中です...</div>
        </div>
      </div>
    </div>
  )
}
