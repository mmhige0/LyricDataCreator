// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SongsTable } from '@/app/songs/SongsTable'
import type { SongsResponse } from '@/types/songs'

const fixture = vi.hoisted(() => ({ data: [] as SongsResponse['data'], push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: fixture.push }) }))
vi.mock('swr/infinite', () => ({ default: () => ({ data: [{ data: fixture.data, hasNext: false }], setSize: vi.fn(), isLoading: false, isValidating: false }) }))

afterEach(() => vi.unstubAllGlobals())
it('displays the original public number and sorts a random selection numerically in both directions', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  fixture.data = ['1000', '099', '010', '001', '0001'].map((gameSongId) => ({
    gameSongId, title: `曲${gameSongId}`, artist: null, youtubeUrl: '', level: null,
  }))
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: fixture.data, hasNext: false, page: 1, pageSize: 10 })))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const click = async (label: string) => act(async () => {
    const button = [...host.querySelectorAll('button')].find(row => row.textContent?.trim().startsWith(label))!
    expect(button).toBeTruthy(); button.click()
  })
  const numbers = () => [...host.querySelectorAll('button.group')].map(row => row.textContent?.match(/No\.([^曲]+)/)?.[1])
  try {
    await act(async () => root.render(<SongsTable />))
    expect(numbers()).toEqual(['1000', '099', '010', '001', '0001'])
    await act(async () => host.querySelectorAll<HTMLButtonElement>('button.group')[3].click())
    expect(fixture.push).toHaveBeenLastCalledWith('/songs/001')
    await click('ランダム')
    await click('No.')
    expect(numbers()).toEqual(['0001', '001', '010', '099', '1000'])
    await click('No.')
    expect(numbers()).toEqual(['1000', '099', '010', '001', '0001'])
  } finally { await act(async () => root.unmount()); host.remove() }
})
