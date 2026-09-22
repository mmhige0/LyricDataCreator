// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useAutoScroll } from '../hooks/useAutoScroll'
import type { ScoreEntry } from '../lib/types'

const entries: ScoreEntry[] = [0, 1, 2].map(i => ({ id: String(i), timestamp: i, lyrics: ['', '', '', ''] }))
let root: Root
let host: HTMLDivElement
let scrollTo: ReturnType<typeof vi.fn<() => void>>
let scrollTop: number
let viewportTop: number
let manualScroll: ReturnType<typeof vi.fn<() => void>>
const rect = (top: number, height: number) => ({ top, height, bottom: top + height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) })
function Harness({ index, enabled = true }: { index: number; enabled?: boolean }) {
  const { entryRefs, scrollContainerRef } = useAutoScroll({ getCurrentLyricsIndex: () => index, scoreEntries: entries, enabled, onUserScroll: manualScroll })
  return <div ref={node => {
    scrollContainerRef.current = node
    if (!node) return
    Object.defineProperties(node, {
      clientHeight: { configurable: true, value: 300 },
      clientTop: { configurable: true, value: 2 },
      scrollTop: { configurable: true, get: () => scrollTop },
    })
    node.getBoundingClientRect = () => rect(viewportTop, 304)
    node.scrollTo = scrollTo
  }}>
    {entries.map((entry, i) => <div key={entry.id} style={{ position: 'relative' }}><div ref={node => {
      entryRefs.current[i] = node
      if (!node) return
      Object.defineProperties(node, {
        offsetTop: { configurable: true, value: 0 },
        clientHeight: { configurable: true, value: 96 },
      })
      node.getBoundingClientRect = () => rect(viewportTop + 2 + i * 400 - scrollTop, 100)
    }}>Page {i}</div></div>)}
  </div>
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  scrollTo = vi.fn()
  manualScroll = vi.fn()
  scrollTop = 0
  viewportTop = 120
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('centers later pages despite each card having offsetTop zero inside a positioned wrapper', async () => {
  await act(async () => root.render(<Harness index={1} />))
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'smooth' })
  await act(async () => root.render(<Harness index={2} />))
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 700, behavior: 'smooth' })
})
it('uses content coordinates after container and document scrolling, including reverse seeking', async () => {
  scrollTop = 550
  viewportTop = -80
  await act(async () => root.render(<Harness index={2} />))
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 700, behavior: 'smooth' })
  scrollTop = 700
  viewportTop = 30
  await act(async () => root.render(<Harness index={1} />))
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'smooth' })
})
it('respects disabled editing follow and enables tracking when switched on', async () => {
  await act(async () => root.render(<Harness index={1} enabled={false} />))
  expect(scrollTo).not.toHaveBeenCalled()
  await act(async () => root.render(<Harness index={1} />))
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'smooth' })
  await act(async () => root.render(<Harness index={1} />))
  expect(scrollTo).toHaveBeenCalledTimes(1)
})
it('ignores automatic scrolling but detects later manual scrolling', async () => {
  await act(async () => root.render(<Harness index={1} />))
  const container = host.firstElementChild!
  scrollTop = 300
  await act(async () => container.dispatchEvent(new Event('scroll')))
  expect(manualScroll).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(600))
  scrollTop = 340
  await act(async () => container.dispatchEvent(new Event('scroll')))
  expect(manualScroll).toHaveBeenCalledOnce()
})
