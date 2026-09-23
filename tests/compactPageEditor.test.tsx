// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ScoreManagementSection } from '../components/ScoreManagementSection'
import { useScoreManagement } from '../hooks/useScoreManagement'
import type { YouTubePlayer } from '../lib/types'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
let root: Root
let host: HTMLDivElement
let score: ReturnType<typeof useScoreManagement>
const seek = vi.fn()
function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const state = useScoreManagement({ currentTime: 0, currentPlayer: null })
  useLayoutEffect(() => { score = state })
  return <ScoreManagementSection scoreEntries={state.scoreEntries} duration={60}
    player={{} as YouTubePlayer} readOnly={readOnly} selectedLyrics={state.selectedLyrics}
    inlineActions={{ onSelect: state.selectLyricsPosition, onStart: state.startInlineEdit,
      onChange: state.changeInlineLyrics, onReplace: state.replaceInlineLyrics, onFinish: state.finishInlineEdit, onCompositionChange: () => {} }}
    addEmptyScoreEntry={state.addEmptyScoreEntry}
    onTimestampChange={state.updateInlineTimestamp} onTimestampCapture={id => state.updateInlineTimestamp('24.50', id)}
    onReplacePageLyrics={state.replacePageLyrics} getCurrentLyricsIndex={() => -1}
    importScoreData={() => {}} exportScoreData={() => {}} deleteScoreEntry={state.deleteScoreEntry}
    clearAllScoreEntries={state.clearAllScoreEntries} seekToAndPlay={seek} bulkAdjustTimings={() => {}}
    undoLastOperation={state.undoLastOperation} redoLastOperation={state.redoLastOperation} canUndo={state.canUndo} canRedo={state.canRedo} />
}
const button = (label: string) => Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes(label))!
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  localStorage.clear()
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: vi.fn() })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
  await act(async () => score.setScoreEntries([
    { id: 'a', timestamp: 10, lyrics: ['あ', '', '', ''] },
    { id: 'b', timestamp: 20, lyrics: ['い', 'う', '', ''] },
  ]))
})
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks()
  delete (HTMLElement.prototype as { hidePopover?: unknown }).hidePopover
})
it('targets the selected lyric page from the shared toolbar without resetting line selection', async () => {
  const line = host.querySelector<HTMLInputElement>('#lyrics-b-1')!
  await act(async () => { line.focus(); line.click() })
  expect(score.selectedLyrics).toEqual({ id: 'b', line: 1 })
  const capture = button('タイムスタンプ入力')
  await act(async () => capture.focus())
  await act(async () => capture.click())
  expect(score.scoreEntries.map(e => e.timestamp)).toEqual([10, 24.5])
  expect(host.querySelector('[data-page-toolbar]')?.textContent).toContain('#2')
  expect(host.querySelectorAll('[data-page-toolbar]')).toHaveLength(1)
  expect(host.querySelectorAll('[data-page-id] input[type="number"]')).toHaveLength(2)
  expect(host.querySelector('[aria-label="ページ2から再生"]')?.textContent).toBe('')
})
it('selects pages from time/menu controls and keeps clearing undoable', async () => {
  await act(async () => host.querySelector<HTMLInputElement>('[aria-label="ページ2の時刻（秒）"]')!.focus())
  expect(score.selectedLyrics?.id).toBe('b')
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="ページ1の操作"]')!.focus())
  expect(score.selectedLyrics?.id).toBe('a')
  const clear = Array.from(host.querySelectorAll<HTMLButtonElement>('[data-page-id="a"] button')).find(b => b.textContent === '歌詞をクリア')!
  await act(async () => clear.click())
  expect(score.scoreEntries[0].lyrics).toEqual(['', '', '', ''])
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].lyrics[0]).toBe('あ')
})
it('keeps one append control for empty/populated lists and creates pages on click', async () => {
  const add = host.querySelector<HTMLButtonElement>('[aria-label="空ページを追加"]')!
  expect(add.closest('[data-page-id]')).toBeNull()
  expect(host.querySelectorAll('[aria-label="空ページを追加"]')).toHaveLength(1)
  await act(async () => score.setScoreEntries([]))
  expect(host.querySelector('[aria-label="空ページを追加"]')).toBe(add)
  expect(button('タイムスタンプ入力').disabled).toBe(true)
  await act(async () => add.click())
  await act(async () => add.click())
  expect(score.scoreEntries.map(entry => entry.timestamp)).toEqual([0, 1])
})
it('keeps playback available in the read-only list without editor controls', async () => {
  await act(async () => root.render(<Harness readOnly />))
  expect(host.querySelector('[data-page-toolbar]')).toBeNull()
  expect(host.querySelector('[aria-label="空ページを追加"]')).toBeNull()
  expect(host.querySelector('[data-page-menu]')).toBeNull()
  await act(async () => host.querySelector<HTMLElement>('[role="button"]')!.click())
  expect(seek).toHaveBeenCalledWith(10)
})
