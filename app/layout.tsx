import type { Metadata } from 'next'
import { Space_Grotesk, Inter_Tight, JetBrains_Mono, Dela_Gothic_One } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-body',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

const popPreviewFont = Dela_Gothic_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pop-preview',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Song Typing Theater',
  description: 'YouTube video lyrics timing tool',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${interTight.variable} ${jetbrainsMono.variable} ${popPreviewFont.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
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
        </ThemeProvider>
      </body>
    </html>
  )
}
