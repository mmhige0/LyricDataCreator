import { afterEach, expect, it, vi } from 'vitest'
import { POST } from '../app/api/hiragana/route'
import { convertLyricsArrayToHiragana } from '../lib/hiraganaUtils'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('keeps katakana out of the reading API even inside mixed-script words', async () => {
  vi.stubEnv('YAHOO_APP_ID', 'test')
  const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
    const text = JSON.parse(init.body as string).params.q
    expect(text).not.toMatch(/[ァ-ヶ]/)
    return Response.json({ result: { word: [{ surface: text, furigana: text === '漢字' ? 'かんじ' : 'ご' }] } })
  })
  vi.stubGlobal('fetch', fetchMock)
  const response = await POST(new Request('http://localhost/api/hiragana', { method: 'POST', body: JSON.stringify({ lines: ['漢字カタカナ語', 'カタカナ', 'ひらがな', ''] }) }))
  expect(await response.json()).toEqual({ lines: ['かんじカタカナご', 'カタカナ', 'ひらがな', ''] })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
it('does not submit decorations for kana conversion and preserves their raw text', async () => {
  const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
    expect(JSON.parse(init.body as string).lines).toEqual(['漢字カタカナ', '', '', ''])
    return Response.json({ lines: ['かんじカタカナ', '', '', ''] })
  })
  vi.stubGlobal('fetch', fetchMock)
  expect(await convertLyricsArrayToHiragana(['漢字カタカナ', '装飾 a/!★', '', ''], [false, true, false, false])).toEqual(['かんじカタカナ', '装飾 a/!★', '', ''])
})
it('keeps fullwidth layout spaces out of the reading API and preserves space-only rows', async () => {
  vi.stubEnv('YAHOO_APP_ID', 'test')
  const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
    const text = JSON.parse(init.body as string).params.q
    expect(text).toBe('漢字')
    return Response.json({ result: { word: [{ surface: text, furigana: 'かんじ' }] } })
  })
  vi.stubGlobal('fetch', fetchMock)
  const response = await POST(new Request('http://localhost/api/hiragana', { method: 'POST', body: JSON.stringify({ lines: ['　　漢字　　カ　', '　　', '', ''] }) }))
  expect(await response.json()).toEqual({ lines: ['　　かんじ　　カ　', '　　', '', ''] })
  expect(fetchMock).toHaveBeenCalledOnce()
})
