// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import AdminPage from '@/app/admin/submissions/page'
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => null }))
vi.mock('@/components/TypingGameContent', () => ({ TypingGameContent: () => null }))
afterEach(() => vi.unstubAllGlobals())
it('saves without a number, checks assigned numbers and registers unsaved changes after overwrite confirmation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let row = { id: 'id', title: '投稿曲', artist: '作者', creatorName: '制作者', status: 'pending', revision: 1, gameSongId: null as string | null, level: null as string | null, txtContent: '10\nあ/い/う/え/1\n', notes: '', youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk' }
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      if (body.action === 'save') {
        row = { ...row, ...body.registration, gameSongId: body.registration.gameSongId || null, revision: row.revision + 1 }
        return Response.json(row)
      }
      return Response.json({})
    }
    if (url.includes('ranking-song')) return Response.json({ gameSongId: '007', rankingSong: { gameSongId: '007', title: '既存曲', artist: '既存作者', level: '5' }, publicSong: null })
    if (url.includes('/submissions/id')) return Response.json(row)
    return Response.json({ submissions: [row], page: 1, hasNext: false })
  })
  vi.stubGlobal('fetch', fetch)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent === label)!
  const input = (label: string) => [...host.querySelectorAll('label')].find(l => l.firstChild?.textContent === label)!.querySelector('input')!
  const change = async (element: HTMLInputElement, value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  try {
    await act(async () => root.render(<SWRConfig value={{ provider: () => new Map() }}><AdminPage /></SWRConfig>))
    await change(input('管理用キー'), 'secret')
    await act(async () => button('一覧を読み込む').click())
    expect(host.querySelector('table')!.textContent).toContain('承認待ち')
    await act(async () => button('確認・編集').click())
    expect(button('ランキングに登録').disabled).toBe(true)
    expect(button('変更を保存').disabled).toBe(false)
    await change(input('曲名'), '保存した曲名')
    await act(async () => button('変更を保存').click())
    expect(host.querySelector('table')!.textContent).toContain('保存した曲名')
    await change(input('曲番号'), '007')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)) })
    expect(host.textContent).toContain('この曲番号は登録済みです。')
    expect(button('ランキングに登録').disabled).toBe(true)
    await change(input('曲名'), '登録用曲名')
    await change(input('難易度'), '8+')
    await act(async () => host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
    expect(button('ランキングに登録').disabled).toBe(false)
    await act(async () => button('ランキングに登録').click())
    const sent = JSON.parse(fetch.mock.calls.find(([, init]) => init?.method === 'POST' && JSON.parse(init.body as string).action === 'approve')![1]!.body as string)
    expect(sent).toMatchObject({ action: 'approve', revision: 2, allowOverwrite: true, registration: { gameSongId: '007', title: '登録用曲名', level: '8+' } })
  } finally { await act(async () => root.unmount()); host.remove() }
})
