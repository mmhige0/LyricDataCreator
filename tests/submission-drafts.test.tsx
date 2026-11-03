// @vitest-environment jsdom
import { act, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Editor from '@/app/editor/page'
import { getDraftList, loadDraft, saveDraft } from '@/lib/draftStorage'
import { getSubmissionForDraft, getSubmissionKeys, saveSubmissionKey } from '@/lib/submissions/client'
import { getSessionId, setSessionId } from '@/lib/sessionStorage'
import { useDraftAutoSave } from '@/hooks/useDraftAutoSave'

vi.mock('@/hooks/useYouTube', () => ({ useYouTube: () => {
  const [youtubeUrl, setYoutubeUrl] = useState(''); const [duration, setDuration] = useState(0)
  return { youtubeUrl, setYoutubeUrl, duration, setDuration, currentTime: 0, player: null, resetPlayer: vi.fn(), loadYouTubeVideo: vi.fn() }
} }))
vi.mock('@/components/SubmissionTurnstile', () => ({ SubmissionTurnstile: ({ onToken }: { onToken: (token: string) => void }) => { useEffect(() => onToken('valid'), [onToken]); return null } }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: ({ actions }: { actions: React.ReactNode }) => <header>{actions}</header> }))
vi.mock('@/components/TypingGameContent', () => ({ TypingGameContent: () => null }))
vi.mock('@/components/YouTubeVideoSection', () => ({ YouTubeVideoSection: () => null }))
vi.mock('@/components/ScoreManagementSection', () => ({ ScoreManagementSection: ({ submissionAction, scoreEntries }: { submissionAction: React.ReactNode; scoreEntries: unknown }) => <div>{submissionAction}<output>{JSON.stringify(scoreEntries)}</output></div> }))
vi.mock('@/components/CentralPopEditor', () => ({ CentralPopEditor: () => null }))
vi.mock('@/components/TimestampOffsetControl', () => ({ TimestampOffsetControl: () => null }))
vi.mock('@/components/EditorShortcuts', () => ({ EditorShortcuts: () => null }))
vi.mock('@/components/HelpSection', () => ({ HelpSection: () => null }))
const id = 'a1b7a034-5a5b-413b-b8b7-56d9d881c911'
const token = 'a'.repeat(43)
const pages = [{ id: 'local', timestamp: 5, lyrics: ['未申請の歌詞', '', '', ''] as [string, string, string, string] }]
const youtubeUrl = 'https://www.youtube.com/watch?v=abcdefghijk'
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  history.replaceState(null, '', '/editor')
  saveDraft('draft-one', youtubeUrl, pages, '下書きの曲名', [], 20)
  saveSubmissionKey({ id, token, title: '投稿曲', draftSessionId: 'draft-one' })
})
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '/') })
async function mount() {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  await act(async () => root.render(<Editor />))
  const click = async (label: string) => act(async () => {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === label)
    expect(button).toBeTruthy(); button!.click()
  })
  return { host, click, cleanup: async () => { await act(async () => root.unmount()); host.remove() } }
}
it('resumes from the draft list with current server metadata and keeps unsent local pages and duration', async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === 'PUT' ? { revision: 5, status: 'pending' } : {
    title: 'サーバーの曲名', youtubeUrl, creatorName: '投稿者', artist: '', notes: '申請の補足', gameSongId: '007', revision: 4, status: 'pending', txtContent: '10\nあ/い/う/え/1\n',
  }))
  vi.stubGlobal('fetch', fetch)
  const { host, click, cleanup } = await mount()
  try {
    await click('申請を編集')
    expect(getSessionId()).toBe('draft-one')
    expect(host.querySelector('output')!.textContent).toContain('未申請の歌詞')
    await click('申請を確認して編集')
    expect(host.querySelector('output')!.textContent).toContain('未申請の歌詞')
    await click('申請内容を確認')
    const title = [...host.querySelectorAll('label')].find(l => l.textContent?.startsWith('曲名'))!.querySelector('input')!
    expect(title.value).toBe('下書きの曲名')
    await act(async () => host.querySelector('dialog form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    const body = JSON.parse(fetch.mock.calls.find(([, init]) => init?.method === 'PUT')![1]!.body as string)
    expect(body).toMatchObject({ revision: 4, title: '下書きの曲名', notes: '申請の補足' })
    expect(body.txtContent).toContain('未申請の歌詞/!/!/!/5.00')
    expect(body.txtContent).toMatch(/^20.0\n/)
    expect(getSubmissionForDraft('draft-one')?.id).toBe(id)
    expect(getDraftList()).toHaveLength(1)
  } finally { await cleanup() }
})
it.each([404, 503])('keeps local content and only detaches a missing submission on %s', async status => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: '申請が見つかりません。' }, { status })))
  const { host, click, cleanup } = await mount()
  try {
    await click('申請を編集'); await click('申請を確認して編集')
    expect(host.querySelector('output')!.textContent).toContain('未申請の歌詞')
    expect(loadDraft('draft-one')?.scoreEntries).toEqual(pages)
    if (status === 404) {
      expect(host.textContent).toContain('下書きは残している')
      expect(getSubmissionKeys()).toHaveLength(0)
      expect(location.search).toBe('')
    } else {
      expect(getSubmissionForDraft('draft-one')?.id).toBe(id)
      expect(location.search).toContain(id)
    }
  } finally { await cleanup() }
})
it('does not write an old autosave snapshot into a newly selected draft session', async () => {
  setSessionId('old-session')
  const host = document.createElement('div'); const root = createRoot(host)
  function Harness() { useDraftAutoSave({ youtubeUrl, scoreEntries: pages, songTitle: '元の下書き' }); return null }
  try {
    await act(async () => root.render(<Harness />))
    setSessionId('new-session')
    await act(async () => window.dispatchEvent(new Event('pagehide')))
    expect(loadDraft('old-session')?.songTitle).toBe('元の下書き')
    expect(loadDraft('new-session')).toBeNull()
  } finally { await act(async () => root.unmount()) }
})
it('keeps the draft association when opening an existing edit link again', () => {
  saveSubmissionKey({ id, token, title: '投稿曲' })
  expect(getSubmissionForDraft('draft-one')?.id).toBe(id)
})
it('reuses the linked draft when the submission URL is reopened without overwriting unsent pages', async () => {
  history.replaceState(null, '', `/editor?submission=${id}`)
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const { cleanup } = await mount()
  try {
    expect(getSessionId()).toBe('draft-one')
    expect(getDraftList()).toHaveLength(1)
    expect(loadDraft('draft-one')?.scoreEntries).toEqual(pages)
    expect(fetch).not.toHaveBeenCalled()
  } finally { await cleanup() }
})
