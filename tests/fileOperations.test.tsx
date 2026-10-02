// @vitest-environment jsdom
import { act, createElement, useLayoutEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useFileOperations } from '../hooks/useFileOperations'
import type { CentralPop, ScoreEntry } from '../lib/types'
import { POP_DEFAULTS } from '../lib/scoreFormat'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
let root: Root
let host: HTMLDivElement
let state: { pages: ScoreEntry[]; pops: CentralPop[]; title: string; duration: number }
let files: ReturnType<typeof useFileOperations>
let content = ''
const checkpoint = vi.fn()
function Harness() {
  const [pages, setPages] = useState<ScoreEntry[]>([{ id: 'old', timestamp: 0, lyrics: ['あ', '', '', ''] }])
  const [pops, setPops] = useState<CentralPop[]>([{ id: 'old-pop', text: 'Hey!', timestamp: 1, ...POP_DEFAULTS }])
  const [title, setTitle] = useState('old title')
  const [duration, setDuration] = useState(30)
  const operations = useFileOperations({ scoreEntries: pages, setScoreEntries: setPages, centralPops: pops, setCentralPops: setPops, duration, setDuration, songTitle: title, setSongTitle: setTitle, onBeforeImport: checkpoint })
  useLayoutEffect(() => { files = operations; state = { pages, pops, title, duration } })
  return null
}
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('prompt', vi.fn(() => 'export'))
  vi.stubGlobal('FileReader', class {
    onload?: (event: { target: { result: string } }) => void
    readAsText() { this.onload?.({ target: { result: content } }) }
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks() })
async function importText(text: string, filename: string) {
  content = text
  const target = { files: [new File([text], filename, { type: 'text/plain' })], value: filename }
  await act(async () => files.handleFileImport({ target } as unknown as React.ChangeEvent<HTMLInputElement>))
  expect(target.value).toBe('')
}
it('keeps pages, pops, duration and title unchanged when an import fails', async () => {
  await importText('50\n_\nHey!/1/m', 'new_2026-10-02_00-00-00.txt')
  expect(state.title).toBe('old title')
  expect(state.duration).toBe(30)
  expect(state.pages[0].id).toBe('old')
  expect(state.pops[0].id).toBe('old-pop')
  expect(checkpoint).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalled()
})
it('imports new pages and pops atomically with one history checkpoint', async () => {
  await importText('30\n!飾り/カナ/!/!/0\n!/!/!/!/999.9\n_\nWow!/2/x/r/l/#123456', 'new_2026-10-02_00-00-00.txt')
  expect(state.title).toBe('new')
  expect(state.pages[0].decorations).toEqual([true, false, false, false])
  expect(state.pages[0].lyrics).toEqual(['飾り', 'カナ', '', ''])
  expect(state.pops[0]).toMatchObject({ text: 'Wow!', duration: 'x', align: 'r', size: 'l', color: '#123456' })
  expect(checkpoint).toHaveBeenCalledTimes(1)
})
it('does not silently lose pops through LRC export', async () => {
  await act(async () => files.exportScoreData('lrc'))
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('TXT'))
  expect(prompt).not.toHaveBeenCalled()
})
it('clears old pops when replacing the document with legacy LRC', async () => {
  await importText('[00:01.00]カナ', 'legacy.lrc')
  expect(state.pops).toEqual([])
  expect(state.pages[0].lyrics[0]).toBe('カナ')
  expect(checkpoint).toHaveBeenCalledTimes(1)
})

it('imports decoration markup as literal text rather than treating it as executable content', async () => {
  await importText('30\n!<script>data:<\\/script>/!/!/!/0', 'literal.txt')
  expect(state.pages[0].lyrics[0]).toBe('<script>data:</script>')
  expect(state.pages[0].decorations?.[0]).toBe(true)
})
