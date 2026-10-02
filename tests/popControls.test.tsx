// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CentralPopEditor } from '../components/CentralPopEditor'
import { registerEditorKeyboardShortcuts, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { POP_DEFAULTS } from '../lib/scoreFormat'

let root: Root
let host: HTMLDivElement
const update = vi.fn()
const play = vi.fn()
const capture = vi.fn()
function Harness() {
  const handler = useKeyboardShortcuts({ player: null, getCurrentTimestamp: capture,
    seekBackward1Second: () => {}, seekForward1Second: () => {},
  })
  useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
  return <CentralPopEditor pops={[{ id: 'pop', text: 'Hey!', timestamp: 12.34, ...POP_DEFAULTS }]}
    onAdd={() => {}} onUpdate={update} onDelete={() => {}} onEditBoundary={() => {}}
    onCompositionChange={() => {}} captureTime={() => 23.45} onPlay={play} />
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('seeks to the pop timestamp and captures time independently', async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="ポップ1から再生"]')!.click())
  expect(play).toHaveBeenCalledExactlyOnceWith(12.34)
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="ポップ1の現在時刻を取得"]')!.click())
  expect(update).toHaveBeenCalledExactlyOnceWith('pop', { timestamp: 23.45 })
})
it('allows F2 from a focused pop field and ignores it during composition', async () => {
  const input = host.querySelector<HTMLInputElement>('[aria-label="ポップ1の文字列"]')!
  input.focus()
  expect(input.closest('[data-pop-id]')?.getAttribute('data-pop-id')).toBe('pop')
  const event = new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true })
  await act(async () => input.dispatchEvent(event))
  expect(capture).toHaveBeenCalledOnce()
  expect(event.defaultPrevented).toBe(true)
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, isComposing: true })))
  expect(capture).toHaveBeenCalledOnce()
})
