// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScoreManagement } from '../hooks/useScoreManagement'
import { useDraftAutoSave } from '../hooks/useDraftAutoSave'
import { loadDraft, saveDraft } from '../lib/draftStorage'
import { setSessionId } from '../lib/sessionStorage'
import { splitLyricsLine } from '../lib/inlineLyrics'
import type { ScoreEntry } from '../lib/types'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

let root: Root
let host: HTMLDivElement
let score: ReturnType<typeof useScoreManagement>
let persistence: ReturnType<typeof useDraftAutoSave>
let composing = false
let enabled = true
const entries: ScoreEntry[] = [
  { id: 'one', timestamp: 10, lyrics: ['はじめ', '', '', ''] },
  { id: 'two', timestamp: 20, lyrics: ['つづき', '', '', ''] },
]

function Harness() {
  const state = useScoreManagement({ currentTime: 0, currentPlayer: null })
  const autoSave = useDraftAutoSave({ youtubeUrl: '', scoreEntries: state.scoreEntries, centralPops: state.centralPops, songTitle: 'テスト', isComposing: composing, enabled })
  useLayoutEffect(() => { score = state; persistence = autoSave })
  return null
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  localStorage.clear()
  sessionStorage.clear()
  setSessionId('test-session')
  composing = false
  enabled = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
  await act(async () => score.setScoreEntries(entries))
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('inline editing and recovery', () => {
  it('saves unnormalized input after one second and normalizes only on leaving the line', async () => {
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.changeInlineLyrics('one', 0, 'カナ abc!'))
    expect(score.scoreEntries[0].lyrics[0]).toBe('カナ abc!')
    await act(async () => vi.advanceTimersByTime(1000))
    expect(loadDraft('test-session')?.scoreEntries[0].lyrics[0]).toBe('カナ abc!')
    expect(persistence.status).toBe('saved')
    await act(async () => score.finishInlineEdit('one', 0, 'カナ abc!'))
    await act(async () => persistence.flush())
    expect(loadDraft('test-session')?.scoreEntries[0].lyrics[0]).toBe('カナ　ａｂｃ！')
  })

  it('groups continuous typing as one undo and preserves redo', async () => {
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.changeInlineLyrics('one', 0, 'あ'))
    await act(async () => score.changeInlineLyrics('one', 0, 'あいう'))
    await act(async () => vi.advanceTimersByTime(1000))
    await act(async () => score.finishInlineEdit('one', 0, 'あいう'))
    await act(async () => score.undoLastOperation())
    expect(score.scoreEntries[0].lyrics[0]).toBe('はじめ')
    expect(score.canUndo).toBe(false)
    await act(async () => score.redoLastOperation())
    expect(score.scoreEntries[0].lyrics[0]).toBe('あいう')
  })

  it('updates only the inline page timestamp and retains input order until blur', async () => {
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.updateInlineTimestamp('30.25'))
    expect(score.scoreEntries.map(e => [e.id, e.timestamp])).toEqual([['one', 30.25], ['two', 20]])
    await act(async () => score.finishInlineEdit('one', 0, 'はじめ'))
    expect(score.scoreEntries.map(e => e.id)).toEqual(['two', 'one'])
  })

  it('flushes latest content on pagehide before the timer has elapsed', async () => {
    await act(async () => score.startInlineEdit('two', 2))
    await act(async () => score.changeInlineLyrics('two', 2, '直前の変更'))
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    expect(loadDraft('test-session')?.scoreEntries[1].lyrics[2]).toBe('直前の変更')
  })

  it('waits for composition to end before the normal autosave', async () => {
    composing = true
    await act(async () => root.render(createElement(Harness)))
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.changeInlineLyrics('one', 0, 'へんかん'))
    await act(async () => vi.advanceTimersByTime(2000))
    expect(loadDraft('test-session')).toBeNull()
    composing = false
    await act(async () => root.render(createElement(Harness)))
    await act(async () => vi.advanceTimersByTime(1000))
    expect(loadDraft('test-session')?.scoreEntries[0].lyrics[0]).toBe('へんかん')
  })

  it('reports a storage failure, retains content, and permits retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await act(async () => persistence.flush())
    expect(persistence.status).toBe('error')
    expect(score.scoreEntries).toEqual(entries)
    failure.mockRestore()
    await act(async () => persistence.flush())
    expect(persistence.status).toBe('saved')
    expect(loadDraft('test-session')?.scoreEntries).toEqual(entries)
  })

  it('persists deletion of the last page even without a YouTube URL', async () => {
    await act(async () => persistence.flush())
    await act(async () => score.clearAllScoreEntries())
    await act(async () => persistence.flush())
    expect(loadDraft('test-session')?.scoreEntries).toEqual([])
  })

  it('does not overwrite drafts while the restore dialog disables saving', async () => {
    enabled = false
    await act(async () => root.render(createElement(Harness)))
    saveDraft('test-session', '', entries, 'existing')
    await act(async () => score.setScoreEntries([]))
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    expect(loadDraft('test-session')?.songTitle).toBe('existing')
  })

  it('normalizes every line changed by a multiline paste when editing ends', async () => {
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.replaceInlineLyrics('one', ['カナ', 'ABC!', '', '']))
    await act(async () => score.finishInlineEdit('one', 0, 'カナ'))
    expect(score.scoreEntries[0].lyrics).toEqual(['カナ', 'ＡＢＣ！', '', ''])
    await act(async () => score.undoLastOperation())
    expect(score.scoreEntries[0].lyrics).toEqual(entries[0].lyrics)
  })

  it('splits a selection into the next line without losing its existing text', () => {
    expect(splitLyricsLine(['あいうえお', 'つづき', '', ''], 0, 1, 3)).toEqual(['あ', 'えお　つづき', '', ''])
  })
})

describe('page controls', () => {
  it.each(['', ' ', 'NaN', 'Infinity', '-1', '12oops'])('rejects invalid timestamp %j without altering data or history', async value => {
    await act(async () => { expect(score.updateInlineTimestamp(value, 'one')).toBe(false) })
    expect(score.scoreEntries).toEqual(entries)
    expect(score.canUndo).toBe(false)
    await act(async () => persistence.flush())
    expect(loadDraft('test-session')?.scoreEntries).toEqual(entries)
  })
  it('commits zero and decimal timestamps, reorders, and supports undo/redo', async () => {
    await act(async () => score.updateInlineTimestamp('0', 'two'))
    expect(score.scoreEntries.map(e => e.id)).toEqual(['two', 'one'])
    await act(async () => score.updateInlineTimestamp('30.25', 'two'))
    expect(score.scoreEntries[1].timestamp).toBe(30.25)
    await act(async () => score.undoLastOperation())
    expect(score.scoreEntries[0].timestamp).toBe(0)
    await act(async () => score.redoLastOperation())
    expect(score.scoreEntries[1].timestamp).toBe(30.25)
  })
  it('clear and conversion each have independent undo and persist', async () => {
    await act(async () => score.replacePageLyrics('one', ['へんかん', '', '', '']))
    await act(async () => score.replacePageLyrics('one', ['', '', '', '']))
    await act(async () => persistence.flush())
    expect(loadDraft('test-session')?.scoreEntries[0].lyrics).toEqual(['', '', '', ''])
    await act(async () => score.undoLastOperation())
    expect(score.scoreEntries[0].lyrics[0]).toBe('へんかん')
    await act(async () => score.undoLastOperation())
    expect(score.scoreEntries[0].lyrics[0]).toBe('はじめ')
  })
  it('rejects stale conversion results without changing data or history', async () => {
    await act(async () => { expect(score.replacePageLyrics('one', ['へんかん', '', '', ''], ['old', '', '', ''])).toBe(false) })
    expect(score.scoreEntries).toEqual(entries)
    expect(score.canUndo).toBe(false)
  })
})


it('persists decoration kinds and pops, and undoes targeted timing changes together', async () => {
  await act(async () => score.toggleDecoration('one', 0))
  await act(async () => score.addCentralPop())
  const id = score.centralPops[0].id
  await act(async () => score.updateCentralPop(id, { text: 'Hey!', timestamp: 12, color: '#123456' }))
  await act(async () => vi.advanceTimersByTime(1000))
  expect(loadDraft('test-session')?.centralPops?.[0]).toMatchObject({ text: 'Hey!', timestamp: 12, color: '#123456' })
  expect(loadDraft('test-session')?.scoreEntries[0].decorations?.[0]).toBe(true)
  await act(async () => score.adjustTimings(2, 'both'))
  expect(score.scoreEntries[0].timestamp).toBe(12)
  expect(score.centralPops[0].timestamp).toBe(14)
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].timestamp).toBe(10)
  expect(score.centralPops[0].timestamp).toBe(12)
  await act(async () => score.redoLastOperation())
  expect(score.centralPops[0].timestamp).toBe(14)
  await act(async () => score.adjustTimings(-1, 'pops'))
  expect(score.scoreEntries[0].timestamp).toBe(12)
  expect(score.centralPops[0].timestamp).toBe(13)
  await act(async () => score.deleteCentralPop(id))
  await act(async () => score.undoLastOperation())
  expect(score.centralPops[0].text).toBe('Hey!')
})

it('normalizes decoration text without lyric conversion and can undo changing its kind', async () => {
  await act(async () => score.toggleDecoration('one', 0))
  await act(async () => score.startInlineEdit('one', 0))
  await act(async () => score.changeInlineLyrics('one', 0, '漢字カナ abc/!★'))
  await act(async () => score.finishInlineEdit('one', 0, '漢字カナ abc/!★'))
  expect(score.scoreEntries[0].lyrics[0]).toBe('漢字カナ abc/!★')
  await act(async () => score.toggleDecoration('one', 0))
  expect(score.scoreEntries[0].lyrics[0]).toBe('漢字カナ　ａｂｃ／！★')
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].lyrics[0]).toBe('漢字カナ abc/!★')
  expect(score.scoreEntries[0].decorations?.[0]).toBe(true)
})

it('pastes decoration kinds and text together, and restores both with Undo', async () => {
  await act(async () => {
    expect(score.replacePageLyrics('one', ['カタカナ', '漢字/\\!★', '', ''], entries[0].lyrics, [false, true, false, false])).toBe(true)
  })
  expect(score.scoreEntries[0].lyrics).toEqual(['カタカナ', '漢字/\\!★', '', ''])
  expect(score.scoreEntries[0].decorations).toEqual([false, true, false, false])
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0]).toEqual(entries[0])
})

it('cancels delayed paste when a row kind changed while reading the clipboard', async () => {
  await act(async () => score.toggleDecoration('one', 0))
  await act(async () => {
    expect(score.replacePageLyrics('one', ['カタカナ', '飾り', '', ''], entries[0].lyrics, [false, true, false, false])).toBe(false)
  })
  expect(score.scoreEntries[0].decorations?.[0]).toBe(true)
})

it('clears only pops and restores them with Undo', async () => {
  await act(async () => { score.addCentralPop(); score.addCentralPop() })
  const pops = score.centralPops
  expect(pops).toHaveLength(2)
  await act(async () => score.clearAllCentralPops())
  expect(score.centralPops).toEqual([])
  expect(score.scoreEntries).toEqual(entries)
  await act(async () => score.undoLastOperation())
  expect(score.centralPops).toEqual(pops)
  expect(score.scoreEntries).toEqual(entries)
})

it('saves decoration alignment to drafts and restores it independently with Undo and Redo', async () => {
  await act(async () => score.toggleDecoration('one', 0))
  await act(async () => score.updateDecorationAlign('one', 0, 'c'))
  await act(async () => score.updateDecorationAlign('one', 0, 'r'))
  await act(async () => vi.advanceTimersByTime(1000))
  expect(loadDraft('test-session')?.scoreEntries[0].decorationAligns?.[0]).toBe('r')
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].decorationAligns?.[0]).toBe('c')
  await act(async () => score.redoLastOperation())
  expect(score.scoreEntries[0].decorationAligns?.[0]).toBe('r')
  await act(async () => score.undoLastOperation())
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].decorationAligns?.[0] ?? 'l').toBe('l')
  expect(score.scoreEntries[0].decorations?.[0]).toBe(true)
})
it('pastes alignment with decorations and rejects delayed paste after alignment changed', async () => {
  const decorations: NonNullable<ScoreEntry['decorations']> = [true, false, false, false]
  await act(async () => score.toggleDecoration('one', 0))
  const original = score.scoreEntries[0]
  await act(async () => score.updateDecorationAlign('one', 0, 'c'))
  await act(async () => {
    expect(score.replacePageLyrics('one', ['右', '', '', ''], original.lyrics, decorations, original.decorations, ['r', 'l', 'l', 'l'], original.decorationAligns)).toBe(false)
  })
  const current = score.scoreEntries[0]
  await act(async () => {
    expect(score.replacePageLyrics('one', ['右', '', '', ''], current.lyrics, decorations, current.decorations, ['r', 'l', 'l', 'l'], current.decorationAligns)).toBe(true)
  })
  expect(score.scoreEntries[0].decorationAligns?.[0]).toBe('r')
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0]).toEqual(current)
})
it('keeps leading and repeated spaces and trims trailing spaces after blur and draft restoration', async () => {
  const value = '　　カ漢★１２ａ　　ナ　'
  await act(async () => score.startInlineEdit('one', 0))
  await act(async () => score.changeInlineLyrics('one', 0, value))
  await act(async () => score.finishInlineEdit('one', 0, value))
  await act(async () => vi.advanceTimersByTime(1000))
  expect(loadDraft('test-session')?.scoreEntries[0].lyrics[0]).toBe(value.trimEnd())
  await act(async () => score.undoLastOperation())
  expect(score.scoreEntries[0].lyrics[0]).toBe('はじめ')
  await act(async () => score.redoLastOperation())
  expect(score.scoreEntries[0].lyrics[0]).toBe(value.trimEnd())
})
