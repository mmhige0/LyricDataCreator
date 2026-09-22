import { useRef, useLayoutEffect, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import type { LyricsArray, ScoreEntry } from '@/lib/types'
import type { LyricsPosition } from '@/lib/lyricsNavigation'
import { splitLyricsLine } from '@/lib/inlineLyrics'

export interface InlineLyricsActions {
  onAppendPage?: (lastId: string, line: number, editing: boolean) => void
  onSelect?: (position: LyricsPosition) => void
  onNavigate?: (position: LyricsPosition, direction: -1 | 1, unit: 'line' | 'page') => LyricsPosition | null
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
  selected?: boolean
}

export function InlineLyricsInput({ entry, line, pageNumber, actions, selected = false }: InlineLyricsInputProps) {
  const latestActions = useRef(actions)
  useLayoutEffect(() => { latestActions.current = actions }, [actions])
  const composing = useRef(false)
  const selectionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = (event: KeyboardEvent<HTMLElement>, editing: boolean) => {
    if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (!actions.onNavigate) return
    event.preventDefault()
    event.stopPropagation()
    const target = actions.onNavigate({ id: entry.id, line }, event.key === 'ArrowUp' ? -1 : 1, event.altKey ? 'page' : 'line')
    if (!target) {
      if (event.key === 'ArrowDown' && !event.repeat && actions.onAppendPage) {
        const nextLine = event.altKey ? line : 0
        // Commit blur normalization and sorting before creating the undo snapshot.
        if (editing) flushSync(() => inputRef.current?.blur())
        latestActions.current.onAppendPage?.(entry.id, nextLine, editing)
      }
      return
    }
    const caret = inputRef.current?.selectionStart ?? 0
    // Blur commits normalization first. IDs remain stable even if F2 reorders pages.
    if (editing) inputRef.current?.blur()
    requestAnimationFrame(() => {
      const element = document.getElementById(`${editing ? 'lyrics' : 'lyrics-selection'}-${target.id}-${target.line}`)
      if (!element) return
      element.focus({ preventScroll: true })
      if (element instanceof HTMLInputElement) {
        const nextCaret = Math.min(caret, element.value.length)
        element.setSelectionRange(nextCaret, nextCaret)
      }
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }
  const focusLine = (index: number, caret: number) => {
    requestAnimationFrame(() => {
      const input = document.getElementById(`lyrics-${entry.id}-${index}`) as HTMLInputElement | null
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div
      ref={selectionRef}
      id={`lyrics-selection-${entry.id}-${line}`}
      data-lyrics-navigation
      tabIndex={-1}
      role="group"
      aria-label={`ページ${pageNumber} ${line + 1}行目の選択`}
      className={`rounded ${selected ? 'bg-primary/10 ring-1 ring-primary/40' : ''} focus:outline-none focus:ring-2 focus:ring-primary`}
      onFocus={event => {
        if (event.target === event.currentTarget) actions.onSelect?.({ id: entry.id, line })
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
          event.preventDefault()
          event.stopPropagation()
          inputRef.current?.focus()
          return
        }
        if (event.key === 'Enter' && event.ctrlKey) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        navigate(event, false)
      }}
    >
      <input
        ref={inputRef}
        id={`lyrics-${entry.id}-${line}`}
        data-inline-lyrics
        aria-label={`ページ${pageNumber} ${line + 1}行目`}
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
            requestAnimationFrame(() => selectionRef.current?.focus({ preventScroll: true }))
            return
          }
          navigate(event, true)
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
    </div>
  )
}
