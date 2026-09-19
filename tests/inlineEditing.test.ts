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
  const autoSave = useDraftAutoSave({ youtubeUrl: '', scoreEntries: state.scoreEntries, songTitle: 'テスト', isComposing: composing, enabled })
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
    expect(loadDraft('test-session')?.scoreEntries[0].lyrics[0]).toBe('かな　ａｂｃ')
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
    await act(async () => score.setTimestamp('99'))
    await act(async () => score.startInlineEdit('one', 0))
    await act(async () => score.updateInlineTimestamp('30.25'))
    expect(score.scoreEntries.map(e => [e.id, e.timestamp])).toEqual([['one', 30.25], ['two', 20]])
    expect(score.timestamp).toBe('99')
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
    expect(score.scoreEntries[0].lyrics).toEqual(['かな', 'ＡＢＣ', '', ''])
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
