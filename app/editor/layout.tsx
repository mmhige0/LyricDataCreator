import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: {
    canonical: '/editor/',
  },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
