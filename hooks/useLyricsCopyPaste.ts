import { useState } from 'react'
import type { LyricsArray } from '@/lib/types'

export const useLyricsCopyPaste = () => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const copyLyricsToClipboard = async (lyrics: LyricsArray) => {
    try {
      const lyricsText = lyrics.join('\n')
      await navigator.clipboard.writeText(lyricsText)
      setCopyStatus('success')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy lyrics:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const pasteLyricsFromClipboard = async (): Promise<LyricsArray | null> => {
    try {
      const text = await navigator.clipboard.readText()
      // Handle both CRLF and LF line endings, and trim CR characters
      const lines = text.split(/\r?\n/).map(line => line.replace(/\r/g, ''))

      // Ensure we have exactly 4 lines, padding with empty strings if needed
      const lyricsArray: LyricsArray = [
        lines[0] || '',
        lines[1] || '',
        lines[2] || '',
        lines[3] || ''
      ]

      return lyricsArray
    } catch (error) {
      console.error('Failed to paste lyrics:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
      return null
    }
  }

  return {
    copyLyricsToClipboard,
    pasteLyricsFromClipboard,
    copyStatus
  }
}