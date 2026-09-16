// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InlineLyricsInput, type InlineLyricsActions } from '../components/InlineLyricsInput'
import { useKeyboardShortcuts, registerEditorKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

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

it('captures IME-shaped Ctrl+Shift+Space before the input blocks propagation and cancels text insertion', async () => {
  const headStart = vi.fn()
  function Harness() {
    const handler = useKeyboardShortcuts({
      player: null, playSelectedPage: headStart,
      getCurrentTimestamp: vi.fn(), addScoreEntry: vi.fn(),
      seekBackward1Second: vi.fn(), seekForward1Second: vi.fn(),
      lyricsInputRefs: { current: [] }, timestampInputRef: { current: null },
    })
    useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
    return <InlineLyricsInput entry={entry} line={0} pageNumber={1} actions={actions} />
  }
  await act(async () => root.render(<Harness />))
  input = host.querySelector('input')!
  await act(async () => input.focus())
  for (const key of [' ', 'Process', '　']) {
    const event = new KeyboardEvent('keydown', {
      key, code: 'Space', keyCode: key === ' ' ? 32 : 229,
      ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
    })
    await act(async () => input.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
  }
  expect(headStart).toHaveBeenCalledTimes(3)
  const composing = new KeyboardEvent('keydown', {
    key: 'Process', code: 'Space', keyCode: 229, isComposing: true,
    ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  })
  await act(async () => input.dispatchEvent(composing))
  expect(composing.defaultPrevented).toBe(true)
  expect(headStart).toHaveBeenCalledTimes(3)
  expect(actions.onChange).not.toHaveBeenCalled()
  await act(async () => root.render(<div />))
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }))
  expect(headStart).toHaveBeenCalledTimes(3)
})

it('blocks shortcut whitespace at beforeinput and restores non-cancelable IME input before onChange', async () => {
  const playback = vi.fn((event: KeyboardEvent) => event.preventDefault())
  const unregister = registerEditorKeyboardShortcuts(playback)
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  try {
    for (const space of [' ', '　']) {
      input.setSelectionRange(1, 2)
      await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Process', code: 'Space', keyCode: 229, ctrlKey: true, shiftKey: true,
        bubbles: true, cancelable: true,
      })))
      const before = new InputEvent('beforeinput', { inputType: 'insertText', data: space, bubbles: true, cancelable: true })
      input.dispatchEvent(before)
      expect(before.defaultPrevented).toBe(true)
      await act(async () => {
        input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertCompositionText', data: space, bubbles: true, cancelable: false }))
        setValue.call(input, `あ${space}う`)
        input.dispatchEvent(new InputEvent('input', { inputType: 'insertCompositionText', data: space, bubbles: true }))
      })
      expect(input.value).toBe('あいう')
      expect(input.selectionStart).toBe(1)
      expect(input.selectionEnd).toBe(2)
      expect(actions.onChange).not.toHaveBeenCalled()
    }
    // A separate ordinary Space press must still insert text.
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }))
    const ordinary = new InputEvent('beforeinput', { inputType: 'insertText', data: ' ', bubbles: true, cancelable: true })
    input.dispatchEvent(ordinary)
    expect(ordinary.defaultPrevented).toBe(false)
    await act(async () => {
      setValue.call(input, 'あ う')
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: ' ', bubbles: true }))
    })
    expect(actions.onChange).toHaveBeenCalledWith('one', 0, 'あ う')
  } finally {
    unregister()
  }
})
