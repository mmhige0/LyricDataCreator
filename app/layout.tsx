import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { withBasePath } from '@/lib/basePath'

export const metadata: Metadata = {
  title: 'Lyric Data Creator',
  description: 'YouTube video lyrics timing tool',
  icons: {
    icon: withBasePath('/favicon.ico'),
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        <Toaster
          richColors
          position="top-right"
          expand
          visibleToasts={5}
          toastOptions={{
            style: {
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            },
          }}
        />
      </body>
    </html>
  )
}
