import { expect, it } from 'vitest'
import { createScoreTxt, parseScoreTxt } from '../lib/scoreFormat'
import { formatDecorationField, parseDecorationField } from '../lib/decorationFormat'
import type { ScoreEntry } from '../lib/types'

it('round trips all alignments, blank decorations, escapes and leading !', () => {
  const page: ScoreEntry = { id: 'page', timestamp: 1, lyrics: ['!A/B\\C', '中央', '右寄せ', ''],
    decorations: [true, true, true, true], decorationAligns: ['l', 'c', 'r', 'r'] }
  const txt = createScoreTxt(30, [page], [])
  expect(txt).toContain('![l]!A\\/B\\\\C/![c]中央/![r]右寄せ/![r]/1.00')
  expect(parseScoreTxt(txt).scoreEntries[0]).toEqual({ ...page, id: expect.any(String) })
})
it('defaults missing in-memory decoration alignment to left and preserves legacy empty rows', () => {
  const txt = createScoreTxt(30, [{ id: 'page', timestamp: 1, lyrics: ['飾り', '', '', ''], decorations: [true, false, false, false] }], [])
  const page = parseScoreTxt(txt).scoreEntries[0]
  expect(txt).toContain('![l]飾り/!/!/!/1.00')
  expect(page.decorationAligns).toEqual(['l', 'l', 'l', 'l'])
  expect(page.decorations).toEqual([true, false, false, false])
})
it.each(['!old', '!!text', '![x]text', '![L]text', '![]text'])('rejects missing or invalid decoration alignment %s', value => {
  expect(() => parseScoreTxt(`30\n${value}/!/!/!/1`)).toThrow(/2行目.*寄せ/)
})
it('keeps prefixes out of displayed length and handles literal bracketed text', () => {
  expect(parseDecorationField(formatDecorationField('[c]' + 'あ'.repeat(20), 'r'))).toEqual({ text: '[c]' + 'あ'.repeat(20), decorated: true, align: 'r' })
  expect(parseScoreTxt(`30\n![c]${'あ'.repeat(25)}/!/!/!/1`).warnings).toEqual([])
})
