// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import Editor from '@/app/editor/page'

vi.mock('@/hooks/useYouTube', () => ({ useYouTube: () => ({
  youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', duration: 10,
  currentTime: 0, player: null, resetPlayer: vi.fn(), loadYouTubeVideo: vi.fn(),
  setYoutubeUrl: vi.fn(), setDuration: vi.fn(),
}) }))
vi.mock('@/hooks/useDraftAutoSave', () => ({ useDraftAutoSave: () => {} }))
vi.mock('@/components/SubmissionTurnstile', () => ({ SubmissionTurnstile: ({ onToken }: { onToken: (token: string) => void }) => {
  useEffect(() => { onToken('valid') }, [onToken])
  return null
} }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: ({ actions }: { actions: React.ReactNode }) => <header>{actions}</header> }))
vi.mock('@/components/TypingGameContent', () => ({ TypingGameContent: () => <div>プレイ中</div> }))
vi.mock('@/components/YouTubeVideoSection', () => ({ YouTubeVideoSection: () => null }))
vi.mock('@/components/ScoreManagementSection', () => ({ ScoreManagementSection: () => null }))
vi.mock('@/components/CentralPopEditor', () => ({ CentralPopEditor: () => null }))
vi.mock('@/components/TimestampOffsetControl', () => ({ TimestampOffsetControl: () => null }))
vi.mock('@/components/EditorShortcuts', () => ({ EditorShortcuts: () => null }))
vi.mock('@/components/HelpSection', () => ({ HelpSection: () => null }))
vi.mock('@/components/DraftRestoreDialog', () => ({ DraftRestoreDialog: () => null }))

const id = 'a1b7a034-5a5b-413b-b8b7-56d9d881c911'
const token = 'a'.repeat(43)
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); history.replaceState(null, '', '/') })
it('keeps a loaded submission revision and unsent edits when switching to play and back', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  history.replaceState(null, '', `/editor?submission=${id}`)
  localStorage.setItem('chart-submission-keys', JSON.stringify([{ id, token, title: '投稿曲' }]))
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => Response.json(init?.method === 'PUT'
    ? { revision: 4, status: 'pending' }
    : { title: '投稿曲', creatorName: '作者', youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', txtContent: '10\nあ/い/う/え/1\n!/!/!/!/999.9\n', revision: 3, status: 'pending' }))
  vi.stubGlobal('fetch', fetch)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const click = async (label: string) => act(async () => {
    const button = [...host.querySelectorAll('button')].find(row => row.textContent === label)
    expect(button).toBeTruthy(); button!.click()
  })
  try {
    await act(async () => root.render(<Editor />))
    await click('投稿内容を読み込む')
    const title = [...host.querySelectorAll('label')].find(row => row.textContent?.startsWith('曲名'))!.querySelector('input')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(title, '未申請の曲名')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('プレイ')
    expect(host.querySelector<HTMLElement>('#editor-panel')!.hidden).toBe(true)
    await click('編集')
    expect(title.value).toBe('未申請の曲名')
    expect(host.querySelector('input[value="未申請の曲名"]')).toBe(title)
    await act(async () => host.querySelector('section[aria-labelledby="submission-heading"] form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, options] = fetch.mock.calls[1]
    expect(url).toBe(`/api/submissions/${id}`)
    expect(options?.method).toBe('PUT')
    expect(JSON.parse(String(options?.body))).toMatchObject({ revision: 3, title: '未申請の曲名' })
  } finally {
    await act(async () => root.unmount()); host.remove()
  }
})
