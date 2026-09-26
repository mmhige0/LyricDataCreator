// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerEditorKeyboardShortcuts, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useLyricsCopyPaste } from '../hooks/useLyricsCopyPaste'

let root: Root
let host: HTMLDivElement
const writeText = vi.fn().mockResolvedValue(undefined)
function Harness({ selected = true }: { selected?: boolean }) {
  const { copyLyricsToClipboard } = useLyricsCopyPaste()
  const handler = useKeyboardShortcuts({
    player: null, getCurrentTimestamp: () => {},
    seekBackward1Second: () => {}, seekForward1Second: () => {},
    copyLyrics: selected ? () => { void copyLyricsToClipboard(['first', '', 'third', 'fourth']) } : undefined,
  })
  useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
  return <><input data-inline-lyrics defaultValue="first" /><textarea defaultValue="title" /><p>selected text</p><div role="dialog"><button>dialog</button></div></>
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  writeText.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  window.getSelection()?.removeAllRanges()
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})
async function copy(options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, ...options })
  await act(async () => { (document.activeElement ?? document.body).dispatchEvent(event) })
  return event
}
it('copies all four lines including empty lines from the selected page', async () => {
  expect((await copy()).defaultPrevented).toBe(true)
  expect(writeText).toHaveBeenCalledExactlyOnceWith('first\n\nthird\nfourth')
})
it('copies a page while editing without a text selection, preserving focus', async () => {
  const input = host.querySelector('input')!
  input.focus(); input.setSelectionRange(2, 2)
  expect((await copy()).defaultPrevented).toBe(true)
  expect(writeText).toHaveBeenCalledOnce()
  expect(document.activeElement).toBe(input)
})
it('preserves native copying of selected lyric text', async () => {
  const input = host.querySelector('input')!
  input.focus(); input.setSelectionRange(0, 3)
  expect((await copy()).defaultPrevented).toBe(false)
  expect(writeText).not.toHaveBeenCalled()
})
it.each(['textarea', '[role="dialog"] button'])('does not override copying in %s', async selector => {
  host.querySelector<HTMLElement>(selector)!.focus()
  expect((await copy()).defaultPrevented).toBe(false)
  expect(writeText).not.toHaveBeenCalled()
})
it('preserves a document text selection', async () => {
  const range = document.createRange()
  range.selectNodeContents(host.querySelector('p')!)
  window.getSelection()!.addRange(range)
  expect((await copy()).defaultPrevented).toBe(false)
  expect(writeText).not.toHaveBeenCalled()
})
it.each([{ shiftKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { repeat: true }])('does not copy on an unrelated or repeated gesture %j', async options => {
  await copy(options)
  expect(writeText).not.toHaveBeenCalled()
})
it('leaves native copy alone without a selected page', async () => {
  await act(async () => root.render(<Harness selected={false} />))
  expect((await copy()).defaultPrevented).toBe(false)
  expect(writeText).not.toHaveBeenCalled()
})
