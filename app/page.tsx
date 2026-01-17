import Link from "next/link"
import { Edit3, Keyboard } from "lucide-react"
import { AppHeader } from "@/components/AppHeader"

export default function LandingPage() {
  return (
    <div className="min-h-screen page-shell">
      <AppHeader
        title="Song Typing Theater"
        titleHref="/"
      />

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-14">
        <div className="flex flex-col gap-6">
          <Link
            href="/editor"
            className="group block rounded-3xl border border-border bg-card/80 p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:bg-card/80"
          >
            <div className="flex items-center gap-4 text-card-foreground">
              <div className="rounded-2xl bg-primary/10 p-4 text-primary dark:bg-primary/20 dark:text-primary">
                <Edit3 className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">歌詞データ作成</h3>
              </div>
            </div>
          </Link>

          <Link
            href="/songs"
            className="group block rounded-3xl border border-border bg-card/80 p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:bg-card/80"
          >
            <div className="flex items-center gap-4 text-card-foreground">
              <div className="rounded-2xl bg-accent/10 p-4 text-accent dark:bg-accent/20 dark:text-accent">
                <Keyboard className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold">練習</h3>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
