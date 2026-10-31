import type { Metadata } from 'next'

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/editor/',
  },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
