// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InlineLyricsInput, type InlineLyricsActions } from '../components/InlineLyricsInput'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

let root: Root
let host: HTMLDivElement
let input: HTMLInputElement
let actions: InlineLyricsActions
const entry = { id: 'one', timestamp: 10, lyrics: ['あいう', '', '', ''] as [string, string, string, string] }

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  actions = { onStart: vi.fn(), onChange: vi.fn(), onReplace: vi.fn(), onFinish: vi.fn(), onCompositionChange: vi.fn() }
  await act(async () => root.render(<InlineLyricsInput entry={entry} line={0} pageNumber={1} actions={actions} />))
  input = host.querySelector('input')!
  await act(async () => input.focus())
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

it('ends editing with Esc and retains the value', async () => {
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(actions.onFinish).toHaveBeenCalledWith('one', 0, 'あいう')
  expect(document.activeElement).not.toBe(input)
})

it('does not split or finish while IME composition is active', async () => {
  await act(async () => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })))
  for (const key of ['Enter', 'Escape']) {
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, isComposing: true })))
  }
  expect(actions.onReplace).not.toHaveBeenCalled()
  expect(actions.onFinish).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(input)
  expect(actions.onCompositionChange).toHaveBeenCalledWith(true)
})

it('does not let Ctrl+Enter bubble into page creation', async () => {
  const listener = vi.fn()
  document.addEventListener('keydown', listener)
  try {
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })))
    expect(actions.onFinish).toHaveBeenCalledWith('one', 0, 'あいう')
    expect(listener).not.toHaveBeenCalled()
  } finally {
    document.removeEventListener('keydown', listener)
  }
})

it('ignores composing keyboard events in the shared shortcut handler', async () => {
  const timestamp = vi.fn()
  const add = vi.fn()
  let handle!: ReturnType<typeof useKeyboardShortcuts>
  function ShortcutsHarness() {
    const handler = useKeyboardShortcuts({
    player: null, getCurrentTimestamp: timestamp, addScoreEntry: add,
    seekBackward1Second: vi.fn(), seekForward1Second: vi.fn(),
    lyricsInputRefs: { current: [] }, timestampInputRef: { current: null },
    })
    useLayoutEffect(() => { handle = handler })
    return null
  }
  await act(async () => root.render(<ShortcutsHarness />))
  handle(new KeyboardEvent('keydown', { key: 'F2', isComposing: true }))
  handle(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true }))
  expect(timestamp).not.toHaveBeenCalled()
  expect(add).not.toHaveBeenCalled()
  handle(new KeyboardEvent('keydown', { key: 'F2' }))
  expect(timestamp).toHaveBeenCalledOnce()
})

it('prioritizes Ctrl+Shift+Space without also toggling playback, including no target', async () => {
  const headStart = vi.fn()
  const play = vi.fn()
  const pause = vi.fn()
  const state = vi.fn(() => 1)
  vi.stubGlobal('YT', { PlayerState: { PLAYING: 1 } })
  let handle!: ReturnType<typeof useKeyboardShortcuts>
  function PlaybackHarness() {
    const handler = useKeyboardShortcuts({
      player: { getPlayerState: state, playVideo: play, pauseVideo: pause } as unknown as import('../lib/types').YouTubePlayer,
      playSelectedPage: headStart,
      getCurrentTimestamp: vi.fn(), addScoreEntry: vi.fn(), seekBackward1Second: vi.fn(), seekForward1Second: vi.fn(),
      lyricsInputRefs: { current: [] }, timestampInputRef: { current: null },
    })
    useLayoutEffect(() => { handle = handler })
    return null
  }
  await act(async () => root.render(<PlaybackHarness />))
  handle(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true }))
  expect(headStart).toHaveBeenCalledOnce()
  expect(state).not.toHaveBeenCalled()
  expect(play).not.toHaveBeenCalled()
  expect(pause).not.toHaveBeenCalled()
  handle(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true }))
  expect(pause).toHaveBeenCalledOnce()
  state.mockReturnValue(2)
  handle(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true }))
  expect(play).toHaveBeenCalledOnce()
  handle(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, isComposing: true }))
  expect(headStart).toHaveBeenCalledOnce()
})
