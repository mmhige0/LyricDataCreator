import { useEffect } from 'react'
import type { YouTubePlayer } from '@/lib/types'

interface KeyboardShortcutsProps {
  player: YouTubePlayer | null
  getCurrentTimestamp: () => void
  addScoreEntry: () => void
  seekBackward1Second: () => void
  seekForward1Second: () => void
  lyricsInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  timestampInputRef: React.MutableRefObject<HTMLInputElement | null>
  timestampOffset?: number
  pasteLyrics?: () => void
  undoLastOperation?: () => void
}

/**
 * キーボードショートカットを管理するフック
 */
export const useKeyboardShortcuts = ({
  player,
  getCurrentTimestamp,
  addScoreEntry,
  seekBackward1Second,
  seekForward1Second,
  lyricsInputRefs,
  timestampInputRef,
  timestampOffset = 0,
  pasteLyrics,
  undoLastOperation
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
      const isSeekBarFocused = (activeElement as HTMLInputElement)?.type === "range"

      if (event.key === "F2") {
        event.preventDefault()
        getCurrentTimestamp()
        return
      }

      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault()
        addScoreEntry()
        return
      }

      if (event.ctrlKey && (event.key === " " || event.code === "Space")) {
        event.preventDefault()
        if (player) {
          const playerState = player.getPlayerState()
          if (playerState === window.YT.PlayerState.PLAYING) {
            player.pauseVideo()
          } else {
            player.playVideo()
          }
        }
        return
      }

      if (event.ctrlKey && event.key === "ArrowLeft") {
        event.preventDefault()
        seekBackward1Second()
        return
      }

      if (event.ctrlKey && event.key === "ArrowRight") {
        event.preventDefault()
        seekForward1Second()
        return
      }

      if (event.ctrlKey && event.shiftKey && (event.key === "V" || event.key === "v")) {
        event.preventDefault()
        if (pasteLyrics) {
          pasteLyrics()
        }
        return
      }

      if (event.ctrlKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault()
        if (undoLastOperation) {
          undoLastOperation()
        }
        return
      }

      if (event.key === "Tab" && isInputFocused) {
        const currentIndex = lyricsInputRefs.current.findIndex((ref) => ref === activeElement)
        if (currentIndex >= 0 && currentIndex < 3) {
          event.preventDefault()
          lyricsInputRefs.current[currentIndex + 1]?.focus()
        } else if (currentIndex === 3) {
          event.preventDefault()
          timestampInputRef.current?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [player, getCurrentTimestamp, addScoreEntry, seekBackward1Second, seekForward1Second, lyricsInputRefs, timestampInputRef, timestampOffset, pasteLyrics, undoLastOperation])
}