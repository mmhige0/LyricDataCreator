import { useState } from 'react'
import type { LyricsArray, ScoreEntry } from '@/lib/types'
import { formatDecorationField, parseDecorationField } from '@/lib/decorationFormat'

export const useLyricsCopyPaste = () => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const copyLyricsToClipboard = async (lyrics: LyricsArray, decorations?: ScoreEntry['decorations'], decorationAligns?: ScoreEntry['decorationAligns']) => {
    try {
      const lyricsText = lyrics.map((line, index) => decorations?.[index] ? formatDecorationField(line, decorationAligns?.[index] ?? 'l') : line).join('\n')
      await navigator.clipboard.writeText(lyricsText)
      setCopyStatus('success')
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (error) {
      console.error('Failed to copy lyrics:', error)
      setCopyStatus('error')
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const pasteLyricsFromClipboard = async (): Promise<{ lyrics: LyricsArray; decorations: NonNullable<ScoreEntry['decorations']>; decorationAligns: NonNullable<ScoreEntry['decorationAligns']> } | null> => {
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

      const parsed = lyricsArray.map(parseDecorationField)
      return {
        lyrics: parsed.map(line => line.text) as LyricsArray,
        decorations: parsed.map(line => line.decorated) as NonNullable<ScoreEntry['decorations']>,
        decorationAligns: parsed.map(line => line.align) as NonNullable<ScoreEntry['decorationAligns']>,
      }
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
