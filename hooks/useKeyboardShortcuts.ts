import type { YouTubePlayer } from '@/lib/types'

interface KeyboardShortcutsProps {
  player: YouTubePlayer | null
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
  getCurrentTimestamp,
  addScoreEntry,
  saveScoreEntry,
  editingId,
  seekBackward1Second,
  seekForward1Second,
  adjustVolume,
  toggleMute,
  lyricsInputRefs,
  timestampInputRef,
  timestampOffset = 0,
  pasteLyrics,
  undoLastOperation,
  redoLastOperation
}: KeyboardShortcutsProps) => {
  return (event: KeyboardEvent) => {
    const activeElement = document.activeElement
    const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
    const isSeekBarFocused = (activeElement as HTMLInputElement)?.type === "range"

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
      if (currentIndex >= 0 && currentIndex < 3) {
        event.preventDefault()
        lyricsInputRefs.current[currentIndex + 1]?.focus()
      } else if (currentIndex === 3) {
        event.preventDefault()
        timestampInputRef.current?.focus()
      }
    }
  }
}