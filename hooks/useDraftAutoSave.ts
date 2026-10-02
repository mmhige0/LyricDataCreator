import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ScoreEntry, CentralPop } from '@/lib/types'
import { saveDraft } from '@/lib/draftStorage'
import { getSessionId } from '@/lib/sessionStorage'

interface UseDraftAutoSaveProps {
  youtubeUrl: string
  scoreEntries: ScoreEntry[]
  centralPops?: CentralPop[]
  songTitle: string
  enabled?: boolean
  isComposing?: boolean
}

export function useDraftAutoSave({
  youtubeUrl,
  scoreEntries,
  centralPops = [],
  songTitle,
  enabled = true,
  isComposing = false,
}: UseDraftAutoSaveProps) {
  const serialized = JSON.stringify({ youtubeUrl, scoreEntries, centralPops, songTitle })
  const latest = useRef({ youtubeUrl, scoreEntries, centralPops, songTitle, enabled, serialized })
  const saved = useRef<string | null>(null)
  const [savedValue, setSavedValue] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const hadContent = useRef(false)

  const flush = useCallback(() => {
    const snapshot = latest.current
    if (!snapshot.enabled || saved.current === snapshot.serialized) return
    // Preserve clearing the final page too, so an old draft cannot reappear.
    if (!snapshot.youtubeUrl && snapshot.scoreEntries.length === 0 && snapshot.centralPops.length === 0 && !hadContent.current) return
    const sessionId = getSessionId()
    const success = sessionId !== null && saveDraft(sessionId, snapshot.youtubeUrl, snapshot.scoreEntries, snapshot.songTitle, snapshot.centralPops)
    setFailed(!success)
    if (success) {
      saved.current = snapshot.serialized
      setSavedValue(snapshot.serialized)
    }
  }, [])

  // Browser persistence: publish the latest committed render before blur/pagehide.
  useLayoutEffect(() => {
    latest.current = { youtubeUrl, scoreEntries, centralPops, songTitle, enabled, serialized }
    if (enabled && (youtubeUrl || scoreEntries.length > 0 || centralPops.length > 0)) hadContent.current = true
    if (!enabled || isComposing) return
    const timeout = window.setTimeout(flush, 1000)
    return () => window.clearTimeout(timeout)
  }, [youtubeUrl, scoreEntries, centralPops, songTitle, enabled, serialized, isComposing, flush])

  useLayoutEffect(() => {
    let blurTimeout: ReturnType<typeof setTimeout> | undefined
    const onFocusOut = () => {
      // Run after React commits the field's blur normalization.
      clearTimeout(blurTimeout)
      blurTimeout = setTimeout(flush, 0)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      clearTimeout(blurTimeout)
      flush()
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [flush])

  const status = failed ? 'error' : savedValue === serialized ? 'saved' :
    (youtubeUrl || scoreEntries.length > 0 || centralPops.length > 0 || savedValue !== null) ? 'pending' : 'idle'
  return { status, flush }
}
