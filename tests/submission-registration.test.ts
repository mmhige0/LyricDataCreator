import { afterEach, expect, it, vi } from 'vitest'
import { findRankingSong, parseRegistration, parseRegistrationDraft } from '@/lib/submissions/registration'

afterEach(() => vi.unstubAllGlobals())
it('looks up the exact zero-padded number even without play records', async () => {
  const song = { gameSongId: '0007', title: '既存曲', artist: null, level: '8+' }
  const fetch = vi.fn().mockResolvedValue(Response.json({ song, rankings: [] }))
  vi.stubGlobal('fetch', fetch)
  expect(await findRankingSong('0007')).toEqual(song)
  expect(fetch.mock.calls[0][0]).toContain('/songs/0007/rankings?players=1&limit=1')
})
it('treats only 404 as unregistered and fails closed on invalid or unavailable responses', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  fetch.mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect(await findRankingSong('007')).toBeNull()
  for (const response of [new Response(null, { status: 500 }), Response.json({}), Response.json({ song: { gameSongId: '008', title: '別曲' } })]) {
    fetch.mockResolvedValueOnce(response)
    await expect(findRankingSong('007')).rejects.toMatchObject({ status: 502 })
  }
})
it('validates registration input without converting identifiers to numbers', () => {
  expect(parseRegistration({ gameSongId: '007', title: '曲名', artist: '', level: '' })).toEqual({ gameSongId: '007', title: '曲名', artist: null, level: null })
  for (const input of [{ gameSongId: 7, title: '曲名' }, { gameSongId: '000', title: '曲名' }, { gameSongId: '007', title: '' }, { gameSongId: '007', title: '曲名', level: '100' }]) expect(() => parseRegistration(input)).toThrow()
})

it('allows saving song information before a number is assigned but requires a number for registration', () => {
  const draft = { title: '曲名', artist: null, level: '5+', gameSongId: '' }
  expect(parseRegistrationDraft(draft)).toEqual({ ...draft, gameSongId: null })
  expect(() => parseRegistration(draft)).toThrow()
  expect(() => parseRegistrationDraft({ ...draft, gameSongId: '00' })).toThrow()
})
