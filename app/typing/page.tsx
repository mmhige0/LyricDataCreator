'use client'

import { useRouter } from 'next/navigation'
import { TypingGameContent } from '@/components/TypingGameContent'

export default function TypingGamePage() {
  const router = useRouter()
  return <TypingGameContent onClose={() => router.push('/')} />
}

