// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SongPlayer } from '@/app/songs/[id]/SongPlayer'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/AppHeader', () => ({ AppHeader: ({ actions }: { actions: React.ReactNode }) => <header>{actions}</header> }))
vi.mock('@/components/TypingGameContent', () => ({ TypingGameContent: () => <div>プレイ画面</div> }))
afterEach(() => vi.unstubAllGlobals())
it('offers a revision application without displaying supplementary notes in the player', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  try {
    const song = { gameSongId: '007', title: '曲', artist: null, youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', level: '-', duration: 10, scoreEntries: [], notes: '非表示の補足情報' }
    await act(async () => root.render(<SongPlayer song={song} />))
    expect(host.querySelector('a')?.textContent).toBe('修正申請する')
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/editor?song=007')
    expect(host.textContent).not.toContain(song.notes)
  } finally { await act(async () => root.unmount()); host.remove() }
})
