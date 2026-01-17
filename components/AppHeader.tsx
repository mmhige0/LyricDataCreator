import Link from 'next/link'
import { ReactNode } from 'react'
import { Music2 } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'

interface AppHeaderProps {
  title: string
  subtitle?: string
  songTitle?: string
  titleHref?: string
  actions?: ReactNode
}

export const AppHeader = ({ title, subtitle, songTitle, titleHref, actions }: AppHeaderProps) => {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-[hsl(var(--header))] dark:supports-[backdrop-filter]:bg-[hsl(var(--header)/0.95)]">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                {titleHref ? (
                  <Link
                    href={titleHref}
                    className="transition-colors hover:opacity-80"
                  >
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
          <div className="flex items-center gap-4 min-w-0">
            {songTitle && (
              <div className="flex-1 min-w-0 text-right text-lg font-medium text-foreground">
                <span className="block truncate">{songTitle}</span>
              </div>
            )}
            <div className="shrink-0">
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
