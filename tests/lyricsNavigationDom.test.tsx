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
  return <>{state.scoreEntries.map((entry, page) => entry.lyrics.map((_, line) => (
    <InlineLyricsInput key={`${entry.id}-${line}`} entry={entry} line={line} pageNumber={page + 1}
      selected={state.selectedLyrics?.id === entry.id && state.selectedLyrics.line === line}
      actions={{ onSelect: state.selectLyricsPosition, onNavigate: (pos, direction, unit) => adjacentLyricsPosition(state.scoreEntries, pos, direction, unit), onStart: state.startInlineEdit, onChange: state.changeInlineLyrics, onReplace: state.replaceInlineLyrics, onFinish: state.finishInlineEdit, onCompositionChange: () => {} }} />
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
it('preserves line position for Alt arrows and stops at the edge', async () => {
  await act(async () => field('a', 2).focus())
  await key(field('a', 2), 'ArrowDown', { altKey: true })
  expect(document.activeElement).toBe(field('b', 2))
  await key(field('b', 2), 'ArrowDown', { altKey: true })
  expect(document.activeElement).toBe(field('b', 2))
  await key(field('b', 2), 'ArrowUp', { altKey: true })
  expect(document.activeElement).toBe(field('a', 2))
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
