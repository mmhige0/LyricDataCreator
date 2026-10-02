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
    onCompositionChange={() => {}} onPlay={play} />
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.clearAllMocks()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('seeks to the pop timestamp', async () => {
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="ポップ1から再生"]')!.click())
  expect(play).toHaveBeenCalledExactlyOnceWith(12.34)

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

it('routes selected-pop shortcuts after focus leaves the pop, preserving native editing', async () => {
  const actions = { capture: vi.fn(), copy: vi.fn(), paste: vi.fn(), delete: vi.fn() }
  function SelectedHarness() {
    const handler = useKeyboardShortcuts({ player: null, getCurrentTimestamp: vi.fn(), popShortcuts: actions,
      seekBackward1Second: () => {}, seekForward1Second: () => {},
    })
    useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
    return <><fieldset data-pop-editor tabIndex={0}><input defaultValue="Hey!" /><select><option>中</option></select></fieldset><button>outside</button><input aria-label="unrelated" /></>
  }
  await act(async () => root.render(<SelectedHarness />))
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    await act(async () => (document.activeElement ?? document.body).dispatchEvent(event))
    return event
  }
  host.querySelector('button')!.focus()
  for (const [key, init] of [['F2', {}], ['Delete', {}], ['c', { ctrlKey: true }], ['v', { ctrlKey: true, shiftKey: true }]] as const) {
    expect((await press(key, init)).defaultPrevented).toBe(true)
  }
  Object.values(actions).forEach(action => expect(action).toHaveBeenCalledOnce())
  const input = host.querySelector('input')!
  input.focus(); input.setSelectionRange(0, 3)
  expect((await press('c', { ctrlKey: true })).defaultPrevented).toBe(false)
  expect((await press('Delete')).defaultPrevented).toBe(false)
  expect((await press('v', { ctrlKey: true })).defaultPrevented).toBe(false)
  expect((await press('v', { ctrlKey: true, shiftKey: true })).defaultPrevented).toBe(true)
  expect(actions.paste).toHaveBeenCalledTimes(2)
  await press('Delete', { isComposing: true })
  expect(actions.delete).toHaveBeenCalledOnce()
  host.querySelector<HTMLInputElement>('[aria-label="unrelated"]')!.focus()
  expect((await press('c', { ctrlKey: true })).defaultPrevented).toBe(false)
  expect(actions.copy).toHaveBeenCalledOnce()
})

it('supports pop PageUp/PageDown and Ctrl+Shift+Space while a field is focused', async () => {
  const navigate = vi.fn()
  const restart = vi.fn()
  function NavigationHarness() {
    const handler = useKeyboardShortcuts({ player: null, getCurrentTimestamp: () => {},
      popShortcuts: { capture: () => {}, copy: () => {}, paste: () => {}, delete: () => {}, navigate },
      playSelectedPage: restart, seekBackward1Second: () => {}, seekForward1Second: () => {},
    })
    useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
    return <div data-pop-editor><input /></div>
  }
  await act(async () => root.render(<NavigationHarness />))
  const input = host.querySelector('input')!; input.focus()
  for (const key of ['PageDown', 'PageUp']) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    await act(async () => input.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
  }
  expect(navigate.mock.calls).toEqual([[1], [-1]])
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })))
  expect(restart).toHaveBeenCalledOnce()
})

it('leaves text editing with Esc so Delete removes the selected pop', async () => {
  const remove = vi.fn()
  function EscapeHarness() {
    const handler = useKeyboardShortcuts({ player: null, getCurrentTimestamp: () => {},
      popShortcuts: { capture: () => {}, copy: () => {}, paste: () => {}, delete: remove },
      seekBackward1Second: () => {}, seekForward1Second: () => {},
    })
    useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
    return <CentralPopEditor pops={[{ id: 'pop', text: 'Hey!', timestamp: 12.34, ...POP_DEFAULTS }]}
      onAdd={() => {}} onUpdate={update} onDelete={remove} onEditBoundary={() => {}} onCompositionChange={() => {}} />
  }
  await act(async () => root.render(<EscapeHarness />))
  const input = host.querySelector<HTMLInputElement>('[aria-label="ポップ1の文字列"]')!
  input.focus()
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(input.closest('[data-pop-id]'))
  await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })))
  expect(remove).toHaveBeenCalledOnce()
})

it('adds a pop with Ctrl+Enter even when no pop has been selected', async () => {
  const add = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0 })
  function AddHarness() {
    const handler = useKeyboardShortcuts({ player: null, getCurrentTimestamp: () => {}, addPage: add,
      seekBackward1Second: () => {}, seekForward1Second: () => {},
    })
    useLayoutEffect(() => registerEditorKeyboardShortcuts(handler), [handler])
    return <div data-pop-editor><button>+</button></div>
  }
  await act(async () => root.render(<AddHarness />))
  const button = host.querySelector('button')!; button.focus()
  await act(async () => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true })))
  expect(add).toHaveBeenCalledOnce()
})
