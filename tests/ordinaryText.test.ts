import { expect, it } from 'vitest'
import { executeTypingInput } from 'lyrics-typing-engine'
import { normalizeTypingDisplay, preprocessAndConvertLyrics } from '../lib/textUtils'
import { createScoreTxt, parseScoreTxt } from '../lib/scoreFormat'
import { createLrcFromScoreEntries, parseLrcToScoreEntries } from '../lib/lrcUtils'
import { buildPageTypingData, createTypingWordForPageLines, skipSpaces } from '../lib/typingEngineAdapter'
import { buildPageKpmMap } from '../lib/kpmUtils'
import type { ScoreEntry } from '../lib/types'

const page: ScoreEntry = { id: 'page', timestamp: 0, lyrics: ['　　カ漢★１２ａ　　ナ　', '　漢字１２？！　', '　　', ''] }
it('preserves fullwidth characters and leading and repeated spaces while removing trailing spaces through TXT and LRC', () => {
  expect(preprocessAndConvertLyrics(page.lyrics[0])).toBe(page.lyrics[0].trimEnd())
  expect(preprocessAndConvertLyrics('  ｶﾞ Ａ１！？　')).toBe('　　ガ　Ａ１！？')
  const txt = createScoreTxt(30, [page], [])
  expect(parseScoreTxt(txt).scoreEntries[0].lyrics).toEqual(page.lyrics.map(line => line.trimEnd()))
  expect(parseLrcToScoreEntries(createLrcFromScoreEntries([page]))[0].lyrics).toEqual(page.lyrics.map(line => line.trimEnd()))
})
it('keeps unsupported characters visible while treating them as spaces for input', () => {
  expect(normalizeTypingDisplay(page.lyrics[0])).toBe('　　カ　　　　ａ　　ナ')
  const data = buildPageTypingData({ scoreEntries: [page], totalDuration: 30 })
  expect(data.pageLyrics[0]).toEqual(page.lyrics.map(preprocessAndConvertLyrics))
  expect(data.builtMapLines[0].wordChunks.map(chunk => chunk.kana).join('').replace(/[ 　]/g, '')).toBe('かａな')
})
it('types only kana and fullwidth letters, automatically skipping non-target characters', () => {
  let word = createTypingWordForPageLines({ scoreEntries: [page], pageIndex: 0, totalDuration: 30, targetLineIndexes: [0, 1, 2, 3] })!
  for (const inputChar of 'kaana') {
    const result = executeTypingInput({ typingWord: skipSpaces(word), inputChar, inputMode: 'roma' })
    expect(result.failKey).toBeFalsy()
    expect(result.successKey).toBeTruthy()
    word = result.nextTypingWord
  }
  expect(skipSpaces(word).nextChunk.kana).toBe('')
})
it('excludes display-only characters and repeated spaces from KPM counts', async () => {
  const map = await buildPageKpmMap({ scoreEntries: [page], totalDuration: 60 })
  expect(map.get('page')?.lines[0].charCount).toEqual({ roma: 5, kana: 3 })
  expect(map.get('page')?.lines[1].charCount).toEqual({ roma: 0, kana: 0 })
  expect(map.get('page')?.totalKpm).toEqual({ roma: 5, kana: 3 })
})

it('converts ASCII digits and punctuation and halfwidth punctuation without changing decoration text', () => {
  const ascii = Array.from({ length: 94 }, (_, index) => String.fromCharCode(index + 33)).join('')
  const fullwidth = Array.from({ length: 94 }, (_, index) => String.fromCharCode(index + 0xFF01)).join('')
  expect(preprocessAndConvertLyrics(ascii)).toBe(fullwidth)
  expect(preprocessAndConvertLyrics('¢£¬¯¦¥₩')).toBe('￠￡￢￣￤￥￦')
  expect(preprocessAndConvertLyrics(' 123!?/\\~｡｢｣､･ ')).toBe('　１２３！？／＼～。「」、・')
  const mixed: ScoreEntry = { id: 'mixed', timestamp: 0, lyrics: [' 123!? ', '123!? ', '', ''], decorations: [false, true, false, false] }
  const restored = parseScoreTxt(createScoreTxt(30, [mixed], [])).scoreEntries[0]
  expect(restored.lyrics.slice(0, 2)).toEqual(['　１２３！？', '123!? '])
})
