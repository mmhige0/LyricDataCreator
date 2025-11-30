import Link from 'next/link'
import { ReactNode } from 'react'

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
      <div className="max-w-[1400px] mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {titleHref ? (
                  <Link href={titleHref} className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
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
            <div className="text-right">
              <div className="font-semibold text-lg">{songTitle}</div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
