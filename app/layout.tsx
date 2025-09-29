import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

const basePath = process.env.NODE_ENV === 'production' ? '/LyricDataCreator' : ''

export const metadata: Metadata = {
  title: 'Lyric Data Creator',
  description: 'YouTube video lyrics timing tool',
  icons: {
    icon: `${basePath}/favicon.ico`,
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