import type { YouTubePlayer } from '@/lib/types'

interface KeyboardShortcutsProps {
  player: YouTubePlayer | null
  playSelectedPage?: () => void
  getCurrentTimestamp: () => void
  addScoreEntry: () => void
  saveScoreEntry?: () => void
  editingId?: string | null
  seekBackward1Second: () => void
  seekForward1Second: () => void
  adjustVolume?: (delta: number) => void
  toggleMute?: () => void
  lyricsInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  timestampInputRef: React.MutableRefObject<HTMLInputElement | null>
  timestampOffset?: number
  pasteLyrics?: () => void
  undoLastOperation?: () => void
  redoLastOperation?: () => void
}

/**
 * キーボードショートカットのイベントハンドラーを返すフック
 * useEffect はコンポーネント側で使用
 */
export const useKeyboardShortcuts = ({
  player,
  playSelectedPage,
  getCurrentTimestamp,
  addScoreEntry,
  saveScoreEntry,
  editingId,
  seekBackward1Second,
  seekForward1Second,
  adjustVolume: _adjustVolume,
  toggleMute: _toggleMute,
  lyricsInputRefs,
  timestampInputRef,
  timestampOffset: _timestampOffset = 0,
  pasteLyrics,
  undoLastOperation,
  redoLastOperation
}: KeyboardShortcutsProps) => {
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    // Handle physical Space before the generic IME guard. IME-enabled browsers
    // may report key="Process" / keyCode=229 even outside active composition.
    if (isPlaybackShortcut(event)) {
      event.preventDefault()
      if (event.isComposing) return
      if (event.shiftKey) {
        playSelectedPage?.()
      } else if (player) {
        if (player.getPlayerState() === window.YT.PlayerState.PLAYING) player.pauseVideo()
        else player.playVideo()
      }
      return
    }
    if (event.isComposing || event.keyCode === 229) return
    const activeElement = document.activeElement
    const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"

    // Ctrl+Shift+V は常に動作（テキストフィールド外でも）
    if (event.ctrlKey && event.shiftKey && (event.key === "V" || event.key === "v")) {
      event.preventDefault()
      if (pasteLyrics) {
        pasteLyrics()
      }
      return
    }

    if (event.key === "F2") {
      event.preventDefault()
      getCurrentTimestamp()
      return
    }

    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault()
      if (editingId && saveScoreEntry) {
        saveScoreEntry()
      } else {
        addScoreEntry()
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

    // Ctrl+Z: 入力フィールド内ではブラウザネイティブのUndo、それ以外ではアプリレベルのUndo
    if (event.ctrlKey && (event.key === "z" || event.key === "Z")) {
      if (isInputFocused) {
        // 入力フィールド内ではブラウザのデフォルト動作を許可
        return
      }
      event.preventDefault()
      if (undoLastOperation) {
        undoLastOperation()
      }
      return
    }

    // Ctrl+Y: 入力フィールド内ではブラウザネイティブのRedo、それ以外ではアプリレベルのRedo
    if (event.ctrlKey && (event.key === "y" || event.key === "Y")) {
      if (isInputFocused) {
        // 入力フィールド内ではブラウザのデフォルト動作を許可
        return
      }
      event.preventDefault()
      if (redoLastOperation) {
        redoLastOperation()
      }
      return
    }

    if (event.key === "Tab" && isInputFocused) {
      const currentIndex = lyricsInputRefs.current.findIndex((ref) => ref === activeElement)
      const isShift = event.shiftKey

      if (currentIndex >= 0) {
        if (isShift && currentIndex > 0) {
          event.preventDefault()
          lyricsInputRefs.current[currentIndex - 1]?.focus()
        } else if (!isShift && currentIndex < 3) {
          event.preventDefault()
          lyricsInputRefs.current[currentIndex + 1]?.focus()
        } else if (!isShift && currentIndex === 3) {
          event.preventDefault()
          timestampInputRef.current?.focus()
        }
      } else if (isShift && activeElement === timestampInputRef.current) {
        event.preventDefault()
        lyricsInputRefs.current[3]?.focus()
      }
    }
  }
}


function isPlaybackShortcut(event: KeyboardEvent) {
  return event.ctrlKey && !event.altKey && !event.metaKey && (event.code === 'Space' || event.key === ' ')
}

export function registerEditorKeyboardShortcuts(handler: (event: KeyboardEvent) => void) {
  // Only playback runs in capture: local Enter/Esc and navigation handlers
  // must retain priority over the other document shortcuts.
  const capturePlayback = (event: KeyboardEvent) => {
    if (isPlaybackShortcut(event)) handler(event)
  }
  document.addEventListener('keydown', capturePlayback, true)
  document.addEventListener('keydown', handler)
  return () => {
    document.removeEventListener('keydown', capturePlayback, true)
    document.removeEventListener('keydown', handler)
  }
}
