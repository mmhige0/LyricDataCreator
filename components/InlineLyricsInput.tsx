import { useRef } from 'react'
import type { LyricsArray, ScoreEntry } from '@/lib/types'
import { splitLyricsLine } from '@/lib/inlineLyrics'

export interface InlineLyricsActions {
  onStart: (id: string, line: number) => void
  onChange: (id: string, line: number, value: string) => void
  onReplace: (id: string, lyrics: LyricsArray) => void
  onFinish: (id: string, line: number, value: string) => void
  onCompositionChange: (composing: boolean) => void
}

interface InlineLyricsInputProps {
  entry: ScoreEntry
  line: number
  pageNumber: number
  actions: InlineLyricsActions
}

export function InlineLyricsInput({ entry, line, pageNumber, actions }: InlineLyricsInputProps) {
  const composing = useRef(false)
  const focusLine = (index: number, caret: number) => {
    requestAnimationFrame(() => {
      const input = document.getElementById(`lyrics-${entry.id}-${index}`) as HTMLInputElement | null
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  return (
    <input
      id={`lyrics-${entry.id}-${line}`}
      data-inline-lyrics
      aria-label={`ページ${pageNumber} ${line + 1}行目`}
      title="クリックして編集・自動保存／F2で時刻更新／Escで編集終了"
      className="w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-inherit hover:border-border focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
      value={entry.lyrics[line]}
      placeholder="!"
      onFocus={() => actions.onStart(entry.id, line)}
      onChange={event => actions.onChange(entry.id, line, event.target.value)}
      onCompositionStart={() => {
        composing.current = true
        actions.onCompositionChange(true)
      }}
      onCompositionEnd={() => {
        composing.current = false
        actions.onCompositionChange(false)
      }}
      onBlur={event => {
        composing.current = false
        actions.onCompositionChange(false)
        actions.onFinish(entry.id, line, event.currentTarget.value)
      }}
      onKeyDown={event => {
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) {
          event.stopPropagation()
          return
        }
        if (event.key === 'Escape' || (event.key === 'Enter' && event.ctrlKey)) {
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.blur()
          return
        }
        if (event.key !== 'Enter' || event.altKey || event.metaKey || event.shiftKey || line === 3) return
        event.preventDefault()
        event.stopPropagation()
        const input = event.currentTarget
        actions.onReplace(entry.id, splitLyricsLine(entry.lyrics, line, input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length))
        focusLine(line + 1, 0)
      }}
      onPaste={event => {
        const text = event.clipboardData.getData('text')
        if (!/[\r\n]/.test(text)) return
        event.preventDefault()
        const input = event.currentTarget
        const parts = text.split(/\r\n|\r|\n/).slice(0, 4 - line)
        const next = [...entry.lyrics] as LyricsArray
        const before = input.value.slice(0, input.selectionStart ?? input.value.length)
        const after = input.value.slice(input.selectionEnd ?? input.value.length)
        parts.forEach((part, offset) => { next[line + offset] = (offset === 0 ? before : '') + part })
        const last = line + parts.length - 1
        next[last] += after
        actions.onReplace(entry.id, next)
        focusLine(last, next[last].length)
      }}
    />
  )
}
