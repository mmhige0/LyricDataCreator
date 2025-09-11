import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lyric Data Creator',
  description: 'YouTube video lyrics timing tool',
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
      </body>
    </html>
  )
}