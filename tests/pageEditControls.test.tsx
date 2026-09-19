// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PageTimestampInput, PageLyricsActions } from '../components/PageEditControls'
import { convertLyricsArrayToHiragana } from '../lib/hiraganaUtils'
import type { LyricsArray, ScoreEntry } from '../lib/types'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock('../lib/hiraganaUtils', () => ({ convertLyricsArrayToHiragana: vi.fn() }))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
async function enter(value: string) {
  const input = host.querySelector('input')!
  await act(async () => input.focus())
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return input
}
it('commits once on Ctrl+Enter and prevents it from adding a page', async () => {
  const onCommit = vi.fn(() => true)
  const outerKey = vi.fn()
  await act(async () => root.render(createElement('div', { onKeyDown: outerKey }, createElement(PageTimestampInput, { timestamp: 10, pageNumber: 1, onCommit }))))
  const input = await enter('12.25')
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })))
  expect(onCommit).toHaveBeenCalledExactlyOnceWith('12.25')
  expect(outerKey).not.toHaveBeenCalled()
})
it('keeps invalid draft separate from saved data, and Escape cancels without saving', async () => {
  const onCommit = vi.fn(() => false)
  await act(async () => root.render(createElement(PageTimestampInput, { timestamp: 10, pageNumber: 1, onCommit })))
  const input = await enter('')
  await act(async () => input.blur())
  expect(input.value).toBe('')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  await act(async () => input.focus())
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(input.value).toBe('10.00')
  expect(onCommit).toHaveBeenCalledTimes(1)
})
it('uses current callback to reject conversion after another edit', async () => {
  let resolve!: (lyrics: LyricsArray) => void
  vi.mocked(convertLyricsArrayToHiragana).mockReturnValue(new Promise(done => { resolve = done }))
  const entry: ScoreEntry = { id: 'one', timestamp: 10, lyrics: ['漢字', '', '', ''] }
  const original = vi.fn(() => true)
  const latest = vi.fn(() => false)
  await act(async () => root.render(createElement(PageLyricsActions, { entry, onReplace: original })))
  await act(async () => host.querySelector('button')!.click())
  await act(async () => root.render(createElement(PageLyricsActions, { entry: { ...entry, lyrics: ['変更', '', '', ''] }, onReplace: latest })))
  await act(async () => resolve(['かんじ', '', '', '']))
  expect(original).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith('one', ['かんじ', '', '', ''], entry.lyrics)
})
