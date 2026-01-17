import Link from 'next/link'
import { ReactNode } from 'react'
import { Music2 } from 'lucide-react'

interface AppHeaderProps {
  title: string
  subtitle?: string
  songTitle?: string
  titleHref?: string
  actions?: ReactNode
}

export const AppHeader = ({ title, subtitle, songTitle, titleHref, actions }: AppHeaderProps) => {
  return (
    <header className="border-b bg-white dark:bg-slate-950">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/50 dark:text-blue-100">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {titleHref ? (
                  <Link href={titleHref} className="transition-colors hover:text-blue-700 dark:hover:text-blue-300">
                    {title}
                  </Link>
                ) : (
                  title
                )}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center">
                {actions}
              </div>
            )}
          </div>
          {songTitle && (
            <div className="max-w-[320px] text-right text-lg font-medium text-slate-700 dark:text-slate-100">
              <span className="truncate">{songTitle}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
