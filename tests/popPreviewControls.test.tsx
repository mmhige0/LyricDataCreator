// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PopPreview } from '../components/PopPreview'
import { POP_DEFAULTS } from '../lib/scoreFormat'

let root: Root
let host: HTMLDivElement
const animate = vi.fn<typeof HTMLElement.prototype.animate>().mockImplementation(() => ({ cancel: vi.fn() }) as unknown as Animation)
const pop = { id: 'pop', text: 'Hey!', timestamp: 0, ...POP_DEFAULTS }
const originalAnimate = HTMLElement.prototype.animate
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  animate.mockClear()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  HTMLElement.prototype.animate = animate as unknown as typeof originalAnimate
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<PopPreview pop={pop} number={1} />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove(); HTMLElement.prototype.animate = originalAnimate; vi.restoreAllMocks(); vi.unstubAllGlobals()
})
async function pointer(type: 'pointerover' | 'pointerout', pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, relatedTarget: document.body })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  await act(async () => host.querySelector('button')!.dispatchEvent(event))
}
it('loops while the mouse is over the preview, including after clicking, and cancels on leaving', async () => {
  await pointer('pointerover')
  expect(animate.mock.calls[0][1]).toMatchObject({ iterations: Infinity })
  const first = animate.mock.results[0].value
  await act(async () => host.querySelector('button')!.click())
  expect(first.cancel).toHaveBeenCalledOnce()
  expect(animate.mock.calls[1][1]).toMatchObject({ iterations: Infinity })
  await pointer('pointerout')
  expect(animate.mock.results[1].value.cancel).toHaveBeenCalledOnce()
})
it('keeps touch and keyboard clicks as a single playback', async () => {
  await pointer('pointerover', 'touch')
  expect(animate).not.toHaveBeenCalled()
  await act(async () => host.querySelector('button')!.click())
  expect(animate.mock.calls[0][1]).toMatchObject({ iterations: 1 })
  await pointer('pointerout', 'touch')
  expect(animate.mock.results[0].value.cancel).not.toHaveBeenCalled()
})
it('restarts hovered playback with updated settings and cancels it on unmount', async () => {
  await pointer('pointerover')
  const first = animate.mock.results[0].value
  await act(async () => root.render(<PopPreview pop={{ ...pop, duration: 'x' }} number={1} />))
  expect(first.cancel).toHaveBeenCalled()
  expect(animate.mock.lastCall?.[1]).toMatchObject({ duration: 2400, iterations: Infinity })
  const last = animate.mock.results.at(-1)!.value
  await act(async () => root.render(null))
  expect(last.cancel).toHaveBeenCalledOnce()
})
