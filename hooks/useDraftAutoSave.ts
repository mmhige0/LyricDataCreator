import { useEffect, useRef } from 'react'
import type { ScoreEntry } from '@/lib/types'
import { saveDraft } from '@/lib/draftStorage'
import { getSessionId } from '@/lib/sessionStorage'

interface UseDraftAutoSaveProps {
  youtubeUrl: string
  scoreEntries: ScoreEntry[]
  songTitle: string
  enabled?: boolean
}

const DEBOUNCE_DELAY = 1000 // 1 second

export function useDraftAutoSave({
  youtubeUrl,
  scoreEntries,
  songTitle,
  enabled = true
}: UseDraftAutoSaveProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousValuesRef = useRef({ youtubeUrl, scoreEntries, songTitle })

  useEffect(() => {
    if (!enabled) return

    const sessionId = getSessionId()
    if (!sessionId) return

    // Don't save if both YouTube URL is empty and there are no score entries
    if (!youtubeUrl && scoreEntries.length === 0) return

    // Serialize values for deep comparison
    const currentSerialized = JSON.stringify({ youtubeUrl, scoreEntries, songTitle })
    const previousSerialized = JSON.stringify(previousValuesRef.current)

    if (currentSerialized === previousSerialized) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      saveDraft(sessionId, youtubeUrl, scoreEntries, songTitle)
      previousValuesRef.current = { youtubeUrl, scoreEntries, songTitle }
    }, DEBOUNCE_DELAY)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [youtubeUrl, scoreEntries, songTitle, enabled])
}
