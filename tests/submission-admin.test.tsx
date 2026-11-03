// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AdminPage from '@/app/admin/submissions/page'
vi.mock('@/components/AppHeader', () => ({ AppHeader: () => null }))
vi.mock('@/components/TypingGameContent', () => ({ TypingGameContent: () => null }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
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
  const button = (label: string) => [...(host.querySelector('section') ?? host).querySelectorAll('button')].find(b => b.textContent === label)!
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
    expect(host.textContent).toContain('変更を保存：LDCの申請内容を更新します。')
    expect(host.textContent).toContain('LDCの公開曲を追加・更新し、申請を削除します。')
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

const tableRow = { id: 'a1b7a034-5a5b-413b-b8b7-56d9d881c911', title: '表の曲', artist: null, creatorName: '投稿者', status: 'pending', revision: 3, gameSongId: '007', level: '-', duplicateCount: 1 }
async function mountTable() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let rows = [tableRow]
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST' || init?.method === 'DELETE') { rows = []; return Response.json({ deleted: true }) }
    if (url.includes('ranking-song')) return Response.json({ gameSongId: '007', rankingSong: { gameSongId: '007', title: '既存曲', artist: null, level: '5' }, publicSong: null, otherSubmissions: [{ id: 'other', title: '別の申請', status: 'rejected' }] })
    return Response.json({ submissions: rows, page: 1, hasNext: false })
  })
  vi.stubGlobal('fetch', fetch)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  await act(async () => root.render(<SWRConfig value={{ provider: () => new Map() }}><AdminPage /></SWRConfig>))
  const key = host.querySelector('input[type=password]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(key, 'secret')
    key.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === '一覧を読み込む')!.click())
  const click = async (label: string, scope: ParentNode = host) => act(async () => [...scope.querySelectorAll('button')].find(b => b.textContent === label)!.click())
  return { host, fetch, click, cleanup: async () => { await act(async () => root.unmount()); host.remove() } }
}
it('registers from the table after checking duplicates and confirming an existing song update', async () => {
  const { host, fetch, click, cleanup } = await mountTable()
  try {
    expect(host.textContent).not.toContain('Discordへ再送')
    expect(host.querySelector('table')!.textContent).toContain('同じ曲番号の申請が他に1件')
    await click('ランキングに登録', host.querySelector('table')!)
    const dialog = host.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.textContent).toContain('LDCの公開曲を追加・更新し、申請を削除します。')
    const confirm = [...dialog.querySelectorAll('button')].find(b => b.textContent === '登録する')!
    expect(confirm.disabled).toBe(true)
    expect(dialog.textContent).toContain('同じ曲番号の申請が他にもあります')
    await act(async () => dialog.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
    await click('登録する', dialog)
    const init = fetch.mock.calls.find(([, init]) => init?.method === 'POST')![1]!
    expect(JSON.parse(init.body as string)).toMatchObject({ action: 'approve', revision: 3, allowOverwrite: true, registration: { gameSongId: '007', title: '表の曲', level: '-' } })
    expect(host.querySelector('dialog')).toBeNull()
  } finally { await cleanup() }
})
it('deletes from the table only after confirmation, and cancellation leaves the row intact', async () => {
  const { host, fetch, click, cleanup } = await mountTable()
  try {
    await click('削除', host.querySelector('table')!)
    expect(host.querySelector('dialog')!.textContent).toContain('この操作は取り消せません')
    await click('キャンセル', host.querySelector('dialog')!)
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    expect(host.querySelector('table')!.textContent).toContain('表の曲')
    await click('削除', host.querySelector('table')!)
    await click('削除する', host.querySelector('dialog')!)
    const init = fetch.mock.calls.find(([, init]) => init?.method === 'DELETE')![1]!
    expect(JSON.parse(init.body as string)).toEqual({ revision: 3 })
    expect(host.querySelector('table')!.textContent).not.toContain('表の曲')
  } finally { await cleanup() }
})
