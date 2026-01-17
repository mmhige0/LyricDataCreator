import Link from "next/link"
import { Edit3, Keyboard } from "lucide-react"
import { AppHeader } from "@/components/AppHeader"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <AppHeader
        title="Song Typing Theater"
        titleHref="/"
      />

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-14">
        <div className="flex flex-col gap-6">
            <Link
              href="/editor"
              className="group block rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                <div className="rounded-2xl bg-sky-100 p-4 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
                  <Edit3 className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold">歌詞データ作成</h3>
                </div>
              </div>
            </Link>

            <Link
              href="/songs"
              className="group block rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900/80"
            >
              <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                <div className="rounded-2xl bg-amber-100 p-4 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200">
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
