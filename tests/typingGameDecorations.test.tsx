// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTypingGame } from '../hooks/useTypingGame'
import { buildPageTypingData } from '../lib/typingEngineAdapter'
import type { PracticeLineSettings, ScoreEntry } from '../lib/types'

let host: HTMLDivElement
let root: Root
let game: ReturnType<typeof useTypingGame>
const scoreEntries: ScoreEntry[] = [{ id: 'page', timestamp: 0, lyrics: ['カ', '装飾★', '', ''], decorations: [false, true, false, false] }]
function Harness({ entries = scoreEntries, mode = 'all' }: { entries?: ScoreEntry[]; mode?: PracticeLineSettings['mode'] }) {
  const state = useTypingGame({ scoreEntries: entries,
    builtMapLines: buildPageTypingData({ scoreEntries: entries, totalDuration: 10 }).builtMapLines,
    totalDuration: 10, currentVideoTime: 0, isPlaying: true,
    practiceLineSettings: { mode, selectedLineIndexes: [0, 1, 2, 3] },
  })
  useLayoutEffect(() => { game = state })
  return null
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Audio', class { volume = 1; currentTime = 0; play() { return Promise.resolve() } })
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it.each(['all', 'random', 'selected'] as const)('excludes decoration from %s practice targets', async mode => {
  await act(async () => root.render(<Harness mode={mode} />))
  expect(game.pageState.targetLineIndexes).toEqual([0])
  for (const key of 'ka') {
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) })))
  }
  expect(game.pageState.typingWord?.nextChunk.kana).toBe('')
  expect(game.totalTypes).toBe(2)
  expect(game.totalMiss).toBe(0)
})
it('does not add misses or input counts on a decoration-only page', async () => {
  await act(async () => root.render(<Harness entries={[{ ...scoreEntries[0], decorations: [true, true, true, true] }]} />))
  expect(game.pageState.targetLineIndexes).toEqual([])
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', keyCode: 65 })))
  expect(game.totalMiss).toBe(0)
  expect(game.totalTypes).toBe(0)
})

it.each(['all', 'random', 'selected'] as const)('ignores display-only ordinary lines in %s practice mode', async mode => {
  await act(async () => root.render(<Harness mode={mode} entries={[{ id: 'page', timestamp: 0, lyrics: ['　カ漢★１２　', '漢字１２？！', '　　', ''] }]} />))
  expect(game.pageState.targetLineIndexes).toEqual([0])
  for (const key of 'ka') {
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, keyCode: key.toUpperCase().charCodeAt(0) })))
  }
  expect(game.pageState.typingWord?.nextChunk.kana).toBe('')
  expect(game.totalTypes).toBe(2)
  expect(game.totalMiss).toBe(0)
})
