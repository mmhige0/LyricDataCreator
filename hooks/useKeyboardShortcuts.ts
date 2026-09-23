import type { YouTubePlayer } from '@/lib/types'

interface KeyboardShortcutsProps {
  player: YouTubePlayer | null
  playSelectedPage?: () => void
  getCurrentTimestamp: () => void
  seekBackward1Second: () => void
  seekForward1Second: () => void
  adjustVolume?: (delta: number) => void
  toggleMute?: () => void
  timestampOffset?: number
  pasteLyrics?: () => void
  undoLastOperation?: () => void
  redoLastOperation?: () => void
  deleteSelectedPage?: () => void
}

/**
 * キーボードショートカットのイベントハンドラーを返すフック
 * useEffect はコンポーネント側で使用
 */
export const useKeyboardShortcuts = ({
  player,
  playSelectedPage,
  getCurrentTimestamp,
  seekBackward1Second,
  seekForward1Second,
  adjustVolume: _adjustVolume,
  toggleMute: _toggleMute,
  timestampOffset: _timestampOffset = 0,
  pasteLyrics,
  undoLastOperation,
  redoLastOperation,
  deleteSelectedPage
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

    // Keep native text deletion while editing. Esc leaves the lyric input.
    if (event.key === 'Delete' && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      if (!isInputFocused && !(activeElement instanceof HTMLElement && (activeElement.isContentEditable || activeElement.closest('[role="dialog"], [popover]:popover-open')))
        && !event.repeat && deleteSelectedPage) {
        event.preventDefault()
        deleteSelectedPage()
      }
      return
    }

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

    // Inline lyrics span multiple inputs, so use the shared application history.
    const isInlineLyrics = activeElement instanceof HTMLElement && activeElement.hasAttribute('data-inline-lyrics')

    // Other text fields retain native undo.
    if (event.ctrlKey && (event.key === "z" || event.key === "Z")) {
      if (isInputFocused && !isInlineLyrics) {
        // 入力フィールド内ではブラウザのデフォルト動作を許可
        return
      }
      event.preventDefault()
      if (undoLastOperation) {
        if (event.shiftKey) redoLastOperation?.()
        else undoLastOperation()
      }
      return
    }

    // Ctrl+Y: 入力フィールド内ではブラウザネイティブのRedo、それ以外ではアプリレベルのRedo
    if (event.ctrlKey && (event.key === "y" || event.key === "Y")) {
      if (isInputFocused && !isInlineLyrics) {
        // 入力フィールド内ではブラウザのデフォルト動作を許可
        return
      }
      event.preventDefault()
      if (redoLastOperation) {
        redoLastOperation()
      }
      return
    }


  }
}


function isPlaybackShortcut(event: KeyboardEvent) {
  return event.ctrlKey && !event.altKey && !event.metaKey && (event.code === 'Space' || event.key === ' ')
}

export function registerEditorKeyboardShortcuts(handler: (event: KeyboardEvent) => void) {
  type TextField = HTMLInputElement | HTMLTextAreaElement
  let pending: { field: TextField; value: string; start: number; end: number } | null = null
  let releaseTimer: ReturnType<typeof setTimeout> | undefined
  const clearPending = () => {
    pending = null
    clearTimeout(releaseTimer)
  }
  // Some IMEs deliver text input separately from the canceled keydown.
  // Limit protection to the same field and this physical shortcut gesture.
  const capturePlayback = (event: KeyboardEvent) => {
    if (!isPlaybackShortcut(event)) {
      clearPending()
      return
    }
    clearTimeout(releaseTimer)
    const field = event.target
    if (!event.isComposing && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
      && field.selectionStart !== null && field.selectionEnd !== null) {
      pending = { field, value: field.value, start: field.selectionStart, end: field.selectionEnd }
    }
    handler(event)
  }
  const beforeInput = (event: Event) => {
    const input = event as InputEvent
    if (pending && input.target === pending.field && /^insert(Text|CompositionText|FromComposition)$/.test(input.inputType)
      && /^[ \u3000]+$/.test(input.data ?? '')) input.preventDefault()
  }
  const onInput = (event: Event) => {
    if (!pending || event.target !== pending.field) return
    const { field, value, start, end } = pending
    const prefix = value.slice(0, start)
    const suffix = value.slice(end)
    const insertedLength = field.value.length - prefix.length - suffix.length
    if (insertedLength <= 0 || !field.value.startsWith(prefix) || !field.value.endsWith(suffix)
      || !/^[ \u3000]+$/.test(field.value.slice(start, start + insertedLength))) return
    // Non-cancelable IME input: restore before React onChange/autosave sees it.
    field.value = value
    field.setSelectionRange(start, end)
    event.stopImmediatePropagation()
  }
  const keypress = (event: KeyboardEvent) => {
    if (pending && event.target === pending.field && (event.code === 'Space' || /^[ \u3000]$/.test(event.key))) event.preventDefault()
  }
  const keyup = () => {
    // Allow an input event queued with keyup, then stop guarding ordinary input.
    releaseTimer = setTimeout(clearPending, 0)
  }
  document.addEventListener('keydown', capturePlayback, true)
  document.addEventListener('keydown', handler)
  document.addEventListener('keypress', keypress, true)
  document.addEventListener('beforeinput', beforeInput, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('keyup', keyup, true)
  document.addEventListener('focusout', clearPending, true)
  window.addEventListener('blur', clearPending)
  return () => {
    clearPending()
    document.removeEventListener('keydown', capturePlayback, true)
    document.removeEventListener('keydown', handler)
    document.removeEventListener('keypress', keypress, true)
    document.removeEventListener('beforeinput', beforeInput, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keyup', keyup, true)
    document.removeEventListener('focusout', clearPending, true)
    window.removeEventListener('blur', clearPending)
  }
}
