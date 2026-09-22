// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InlineLyricsInput } from '../components/InlineLyricsInput'
import { useScoreManagement } from '../hooks/useScoreManagement'
import { useDraftAutoSave } from '../hooks/useDraftAutoSave'
import { adjacentLyricsPosition } from '../lib/lyricsNavigation'
import { loadDraft } from '../lib/draftStorage'
import { setSessionId } from '../lib/sessionStorage'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn() } }))
let root: Root
let host: HTMLDivElement
let score: ReturnType<typeof useScoreManagement>
let frames: FrameRequestCallback[]
let scroll: ReturnType<typeof vi.fn>

function Harness() {
  const state = useScoreManagement({ currentTime: 0, currentPlayer: null })
  useDraftAutoSave({ youtubeUrl: '', songTitle: '', scoreEntries: state.scoreEntries })
  useLayoutEffect(() => { score = state })
  return <>{state.scoreEntries.flatMap((entry, page) => entry.lyrics.map((_, line) => (
    <InlineLyricsInput key={`${entry.id}-${line}`} entry={entry} line={line} pageNumber={page + 1}
      selected={state.selectedLyrics?.id === entry.id && state.selectedLyrics.line === line}
      actions={{ onAppendPage: state.appendPageFromNavigation, onSelect: state.selectLyricsPosition, onNavigate: (pos, direction, unit) => adjacentLyricsPosition(state.scoreEntries, pos, direction, unit), onStart: state.startInlineEdit, onChange: state.changeInlineLyrics, onReplace: state.replaceInlineLyrics, onFinish: state.finishInlineEdit, onCompositionChange: () => {} }} />
  )))}</>
}
const field = (id: string, line: number) => document.getElementById(`lyrics-${id}-${line}`) as HTMLInputElement
async function key(element: HTMLElement, key: string, options: KeyboardEventInit = {}) {
  await act(async () => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })))
  await act(async () => { frames.splice(0).forEach(fn => fn(0)) })
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  frames = []
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.push(fn); return frames.length })
  scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  localStorage.clear()
  sessionStorage.clear()
  setSessionId('navigation')
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Harness />))
  await act(async () => score.setScoreEntries([
    { id: 'a', timestamp: 0, lyrics: ['abc', '', '', 'カナ'] },
    { id: 'b', timestamp: 10, lyrics: ['next', '', '', ''] },
  ]))
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})
it('finishes, normalizes and saves before moving to the next page', async () => {
  await act(async () => field('a', 3).focus())
  await key(field('a', 3), 'ArrowDown')
  expect(document.activeElement).toBe(field('b', 0))
  expect(score.selectedLyrics).toEqual({ id: 'b', line: 0 })
  expect(score.scoreEntries[0].lyrics[3]).toBe('かな')
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  expect(loadDraft('navigation')?.scoreEntries[0].lyrics[3]).toBe('かな')
  expect(scroll).toHaveBeenCalled()
})
it('preserves line position for Alt arrows', async () => {
  await act(async () => field('a', 2).focus())
  await key(field('a', 2), 'ArrowDown', { altKey: true })
  expect(document.activeElement).toBe(field('b', 2))
  await key(field('b', 2), 'ArrowUp', { altKey: true })
  expect(document.activeElement).toBe(field('a', 2))
})
it('moves across all pages with Ctrl arrows, positions the caret and commits edits', async () => {
  await act(async () => score.setScoreEntries(previous => previous.map(entry => entry.id === 'b' ? { ...entry, lyrics: ['', '', '', 'カナ'] } : entry)))
  await act(async () => field('a', 1).focus())
  await key(field('a', 1), 'ArrowDown', { ctrlKey: true })
  expect(document.activeElement).toBe(field('b', 3))
  expect(field('b', 3).selectionStart).toBe(0)
  expect(field('b', 3).selectionEnd).toBe(0)
  await key(field('b', 3), 'ArrowUp', { ctrlKey: true })
  expect(document.activeElement).toBe(field('a', 0))
  expect(field('a', 0).selectionStart).toBe(0)
  expect(field('a', 0).selectionEnd).toBe(0)
  expect(score.scoreEntries[1].lyrics[3]).toBe('かな')
  expect(score.inlineEditing).toEqual({ id: 'a', line: 0 })
  expect(scroll).toHaveBeenCalled()
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  expect(loadDraft('navigation')?.scoreEntries[1].lyrics[3]).toBe('かな')
})
it('moves selection across all pages without entering edit mode', async () => {
  await act(async () => field('a', 1).focus())
  await key(field('a', 1), 'Escape')
  await key(document.activeElement as HTMLElement, 'ArrowDown', { ctrlKey: true })
  expect(score.selectedLyrics).toEqual({ id: 'b', line: 3 })
  expect(score.inlineEditing).toBeNull()
  await key(document.activeElement as HTMLElement, 'ArrowUp', { ctrlKey: true })
  expect(score.selectedLyrics).toEqual({ id: 'a', line: 0 })
  expect(score.inlineEditing).toBeNull()
})
it('resolves the final page after blur sorts an updated timestamp', async () => {
  await act(async () => field('a', 1).focus())
  await act(async () => score.updateInlineTimestamp('20', 'a'))
  await key(field('a', 1), 'ArrowDown', { ctrlKey: true })
  expect(score.scoreEntries.map(entry => entry.id)).toEqual(['b', 'a'])
  expect(document.activeElement).toBe(field('a', 3))
  await key(field('a', 3), 'ArrowUp', { ctrlKey: true })
  expect(document.activeElement).toBe(field('b', 0))
})
it('keeps Ctrl arrows within the last page, including empty boundary lines and repeated keys', async () => {
  await act(async () => field('b', 1).focus())
  await key(field('b', 1), 'ArrowDown', { ctrlKey: true })
  await key(field('b', 3), 'ArrowDown', { ctrlKey: true, repeat: true })
  expect(document.activeElement).toBe(field('b', 3))
  expect(field('b', 3).selectionStart).toBe(0)
  expect(score.scoreEntries).toHaveLength(2)
})
it('leaves composition and other Ctrl arrow combinations alone', async () => {
  await act(async () => field('a', 1).focus())
  for (const options of [{ isComposing: true }, { keyCode: 229 }, { shiftKey: true }, { altKey: true }, { metaKey: true }]) {
    await key(field('a', 1), 'ArrowDown', { ctrlKey: true, ...options })
    expect(document.activeElement).toBe(field('a', 1))
  }
  expect(scroll).not.toHaveBeenCalled()
})
it('keeps selection after Esc, navigates without editing, and resumes with Enter', async () => {
  await act(async () => field('a', 0).focus())
  await key(field('a', 0), 'Escape')
  const selected = document.getElementById('lyrics-selection-a-0')!
  expect(document.activeElement).toBe(selected)
  expect(score.inlineEditing).toBeNull()
  await key(selected, 'ArrowDown')
  expect(score.selectedLyrics).toEqual({ id: 'a', line: 1 })
  expect(score.inlineEditing).toBeNull()
  await key(document.activeElement as HTMLElement, 'Enter')
  expect(document.activeElement).toBe(field('a', 1))
  expect(score.inlineEditing).toEqual({ id: 'a', line: 1 })
})
it('does not navigate during IME composition or modified text selection', async () => {
  await act(async () => field('a', 0).focus())
  await key(field('a', 0), 'ArrowDown', { isComposing: true })
  await key(field('a', 0), 'ArrowDown', { shiftKey: true })
  expect(document.activeElement).toBe(field('a', 0))
  expect(scroll).not.toHaveBeenCalled()
})
it('updates the selected page timestamp after editing ends and preserves selection through sorting', async () => {
  await act(async () => field('a', 1).focus())
  await key(field('a', 1), 'Escape')
  const addTimestamp = score.timestamp
  await act(async () => score.updateInlineTimestamp('20', score.selectedLyrics!.id))
  expect(score.scoreEntries.map(entry => entry.id)).toEqual(['b', 'a'])
  expect(score.scoreEntries[1].timestamp).toBe(20)
  expect(score.timestamp).toBe(addTimestamp)
  expect(score.selectedLyrics).toEqual({ id: 'a', line: 1 })
  expect(score.inlineEditing).toBeNull()
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries.find(entry => entry.id === 'a')?.timestamp).toBe(0)
})

it('Ctrl+Enter finishes editing but never adds a page from the selection', async () => {
  await act(async () => field('b', 3).focus())
  await key(field('b', 3), 'Enter', { ctrlKey: true })
  await key(document.activeElement as HTMLElement, 'Enter', { ctrlKey: true })
  expect(score.scoreEntries).toHaveLength(2)
  expect(score.inlineEditing).toBeNull()
})
it('appends on Down from the last line, normalizes before the undo snapshot, and saves', async () => {
  await act(async () => score.setLyrics(['左の下書き', '', '', '']))
  await act(async () => score.setTimestamp('42'))
  await act(async () => field('b', 3).focus())
  await act(async () => score.changeInlineLyrics('b', 3, 'カナ'))
  await key(field('b', 3), 'ArrowDown')
  const added = score.scoreEntries[2]
  expect(added.timestamp).toBe(11)
  expect(document.activeElement).toBe(field(added.id, 0))
  expect(score.scoreEntries[1].lyrics[3]).toBe('かな')
  expect(score.lyrics[0]).toBe('左の下書き')
  expect(score.timestamp).toBe('42')
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  expect(loadDraft('navigation')?.scoreEntries).toHaveLength(3)
  await key(field(added.id, 0), 'Escape')
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries.map(entry => entry.id)).toEqual(['a', 'b'])
  expect(score.scoreEntries[1].lyrics[3]).toBe('かな')
  await act(async () => score.redoLastOperation())
  expect(score.scoreEntries[2]).toEqual(added)
})
it.each([0, 1, 2, 3])('Alt+Down appends and preserves line %i', async line => {
  await act(async () => field('b', line).focus())
  await key(field('b', line), 'ArrowDown', { altKey: true })
  expect(score.scoreEntries).toHaveLength(3)
  expect(document.activeElement).toBe(field(score.scoreEntries[2].id, line))
})
it('selection mode remains selected after append, repeat and IME cannot append', async () => {
  await act(async () => field('b', 3).focus())
  await key(field('b', 3), 'ArrowDown', { repeat: true })
  await key(field('b', 3), 'ArrowDown', { isComposing: true })
  await key(field('b', 3), 'ArrowDown', { shiftKey: true })
  expect(score.scoreEntries).toHaveLength(2)
  await key(field('b', 3), 'Escape')
  await key(document.activeElement as HTMLElement, 'ArrowDown')
  const added = score.scoreEntries[2]
  expect(document.activeElement?.id).toBe(`lyrics-selection-${added.id}-0`)
  expect(score.inlineEditing).toBeNull()
})
it('Down within the final page only moves to the next line', async () => {
  await act(async () => field('b', 1).focus())
  await key(field('b', 1), 'ArrowDown')
  expect(score.scoreEntries).toHaveLength(2)
  expect(document.activeElement).toBe(field('b', 2))
})
it('adds a first page at zero and appends after the last page', async () => {
  await act(async () => score.setScoreEntries([]))
  await act(async () => score.addEmptyScoreEntry())
  await act(async () => { frames.splice(0).forEach(fn => fn(0)) })
  const first = score.scoreEntries[0]
  expect(first.timestamp).toBe(0)
  expect(document.activeElement).toBe(field(first.id, 0))
  await key(field(first.id, 0), 'ArrowDown', { altKey: true })
  expect(score.scoreEntries.map(entry => entry.timestamp)).toEqual([0, 1])
  expect(new Set(score.scoreEntries.map(entry => entry.id)).size).toBe(2)
})
it('inserts directly after a page even when adjacent timestamps match', async () => {
  await act(async () => score.setScoreEntries(score.scoreEntries.map(entry => ({ ...entry, timestamp: 10 }))))
  await act(async () => score.addEmptyScoreEntry('a'))
  expect(score.scoreEntries[0].id).toBe('a')
  expect(score.scoreEntries[1].timestamp).toBe(10)
  expect(score.scoreEntries[2].id).toBe('b')
})

it('inserts before the first page, focuses it and preserves undo/redo and draft saving', async () => {
  await act(async () => score.setScoreEntries(score.scoreEntries.map(entry => ({ ...entry, timestamp: entry.timestamp + 10 }))))
  await act(async () => score.addEmptyScoreEntry('a', 'before'))
  await act(async () => { frames.splice(0).forEach(fn => fn(0)) })
  const first = score.scoreEntries[0]
  expect(first.timestamp).toBe(5)
  expect(score.scoreEntries.map(entry => entry.id)).toEqual([first.id, 'a', 'b'])
  expect(document.activeElement).toBe(field(first.id, 0))
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  expect(loadDraft('navigation')?.scoreEntries[0]).toEqual(first)
  await key(field(first.id, 0), 'Escape')
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries.map(entry => entry.id)).toEqual(['a', 'b'])
  await act(async () => score.redoLastOperation())
  expect(score.scoreEntries[0]).toEqual(first)
})
it('inserts before a middle page and at zero without making negative timestamps', async () => {
  await act(async () => score.addEmptyScoreEntry('b', 'before'))
  expect(score.scoreEntries.map(entry => entry.timestamp)).toEqual([0, 5, 10])
  expect(score.scoreEntries[2].id).toBe('b')
  await act(async () => score.addEmptyScoreEntry('a', 'before'))
  expect(score.scoreEntries.map(entry => entry.timestamp)).toEqual([0, 0, 5, 10])
  expect(score.scoreEntries[1].id).toBe('a')
  await act(async () => score.addEmptyScoreEntry('missing', 'before'))
  expect(score.scoreEntries).toHaveLength(4)
})
