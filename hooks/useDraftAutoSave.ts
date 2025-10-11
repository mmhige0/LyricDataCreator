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

    // Check if any values have changed
    const hasChanged =
      youtubeUrl !== previousValuesRef.current.youtubeUrl ||
      scoreEntries !== previousValuesRef.current.scoreEntries ||
      songTitle !== previousValuesRef.current.songTitle

    if (!hasChanged) return

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
