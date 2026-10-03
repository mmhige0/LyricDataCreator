// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useScoreManagement } from '../hooks/useScoreManagement'
import { TimestampOffsetControl } from '../components/TimestampOffsetControl'
import { captureTimestamp } from '../lib/timestampCapture'
import type { YouTubePlayer } from '../lib/types'
import { POP_DEFAULTS } from '../lib/scoreFormat'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
let root: Root
let host: HTMLDivElement
let score: ReturnType<typeof useScoreManagement>
const time = vi.fn(() => 30)
const player = { getCurrentTime: time, getDuration: () => 120 } as unknown as YouTubePlayer
function Harness() {
  const state = useScoreManagement({ currentTime: 1, currentPlayer: player })
  useLayoutEffect(() => { score = state })
  return <TimestampOffsetControl value={state.timestampOffset} onChange={state.setTimestampOffset} />
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  localStorage.clear(); time.mockReturnValue(30)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('uses -0.15 by default, changes in 0.01 steps, persists and resets to the default', async () => {
  await act(async () => root.render(<Harness />))
  expect(score.timestampOffset).toBe(-0.15)
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="入力補正を0.01秒減らす"]')!.click())
  expect(score.timestampOffset).toBe(-0.16)
  expect(localStorage.getItem('timestampOffset')).toBe('-0.16')
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="入力補正を0.01秒増やす"]')!.click())
  expect(score.timestampOffset).toBe(-0.15)
  await act(async () => score.setTimestampOffset(-0.5))
  await act(async () => Array.from(host.querySelectorAll('button')).find(e => e.textContent === 'リセット')!.click())
  expect(score.timestampOffset).toBe(-0.15)
})
it.each(['0', '-0.37'])('prefers saved offset %s to the default', async value => {
  localStorage.setItem('timestampOffset', value)
  await act(async () => root.render(<Harness />))
  expect(score.timestampOffset).toBe(Number(value))
})
it.each(['', 'garbage', 'Infinity'])('ignores invalid stored offset %j', async value => {
  localStorage.setItem('timestampOffset', value)
  await act(async () => root.render(<Harness />))
  expect(score.timestampOffset).toBe(-0.15)
})
it('captures live player time for both add paths, applies offset and keeps undo', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => score.addEmptyScoreEntry())
  const first = score.scoreEntries[0]
  expect(first.timestamp).toBe(29.85)
  time.mockReturnValue(40.5)
  await act(async () => score.appendPageFromNavigation(first.id, 2, true))
  expect(score.scoreEntries[1].timestamp).toBe(40.35)
  expect(score.selectedLyrics?.line).toBe(2)
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries).toEqual([first])
  await act(async () => score.redoLastOperation())
  expect(score.scoreEntries[1].timestamp).toBe(40.35)
})
it('clamps capture at zero/duration and rounds seconds', () => {
  expect(captureTimestamp(0.1, -0.15, 120)).toBe(0)
  expect(captureTimestamp(119.9, 0.5, 120)).toBe(120)
  expect(captureTimestamp(10.456, -0.15, 0)).toBe(10.31)
})

it('undoes each pop timestamp capture separately from bulk adjustment and supports redo', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => {
    score.setScoreEntries([{ id: 'page', timestamp: 10, lyrics: ['', '', '', ''] }])
    score.setCentralPops([{ id: 'pop', text: 'Hey!', timestamp: 20, ...POP_DEFAULTS }])
  })
  await act(async () => score.updateCentralPop('pop', { timestamp: 30 }))
  await act(async () => score.adjustTimings(5, 'both'))
  await act(async () => score.updateCentralPop('pop', { timestamp: 40 }))
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].timestamp).toBe(15)
  expect(score.centralPops[0].timestamp).toBe(35)
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].timestamp).toBe(10)
  expect(score.centralPops[0].timestamp).toBe(30)
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0].timestamp).toBe(20)
  for (const timestamp of [30, 35, 40]) {
    await act(async () => score.redoLastOperation())
    expect(score.centralPops[0].timestamp).toBe(timestamp)
  }
  expect(score.scoreEntries[0].timestamp).toBe(15)
})

it('keeps consecutive pop timestamp captures independent and ignores unchanged values', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => score.setCentralPops([{ id: 'pop', text: '', timestamp: 20, ...POP_DEFAULTS }]))
  await act(async () => score.updateCentralPop('pop', { timestamp: 30 }))
  await act(async () => score.updateCentralPop('pop', { timestamp: 40 }))
  await act(async () => score.updateCentralPop('pop', { timestamp: 40 }))
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0].timestamp).toBe(30)
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0].timestamp).toBe(20)
  expect(score.canUndo).toBe(false)
})

it('groups continuous pop editing but starts a fresh group after another operation', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => score.setCentralPops([{ id: 'pop', text: '', timestamp: 20, ...POP_DEFAULTS }]))
  await act(async () => score.updateCentralPop('pop', { text: 'H' }, 'edit'))
  await act(async () => score.updateCentralPop('pop', { text: 'Hey' }, 'edit'))
  await act(async () => score.adjustTimings(5, 'pops'))
  await act(async () => score.updateCentralPop('pop', { text: 'Hey!' }, 'edit'))
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0]).toMatchObject({ text: 'Hey', timestamp: 25 })
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0]).toMatchObject({ text: 'Hey', timestamp: 20 })
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0]).toMatchObject({ text: '', timestamp: 20 })
  expect(score.canUndo).toBe(false)
})

it('inserts plus-button pages by captured timestamp, including ties and earlier times', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => score.setScoreEntries([
    { id: 'a', timestamp: 10, lyrics: ['', '', '', ''] },
    { id: 'b', timestamp: 40, lyrics: ['', '', '', ''] },
  ]))
  await act(async () => score.addEmptyScoreEntry())
  expect(score.scoreEntries.map(e => e.timestamp)).toEqual([10, 29.85, 40])
  const middle = score.selectedLyrics!.id
  time.mockReturnValue(10.15)
  await act(async () => score.addEmptyScoreEntry())
  expect(score.scoreEntries.map(e => e.timestamp)).toEqual([10, 10, 29.85, 40])
  expect(score.scoreEntries[0].id).toBe('a')
  time.mockReturnValue(0)
  await act(async () => score.addEmptyScoreEntry())
  expect(score.scoreEntries[0].timestamp).toBe(0)
  expect(score.scoreEntries[3].id).toBe(middle)
})
