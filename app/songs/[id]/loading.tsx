import { AppHeader } from "@/components/AppHeader"

export default function SongLoading() {
  return (
    <div className="min-h-screen page-shell">
      <AppHeader title="Song Typing Theater" titleHref="/" />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-2 w-24 animate-pulse rounded-full bg-muted-foreground/30" />
          <div className="text-sm text-muted-foreground">曲を読み込み中です...</div>
        </div>
      </div>
    </div>
  )
}
