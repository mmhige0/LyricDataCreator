import { describe, expect, it } from 'vitest'
import { createScoreTxt, parseScoreTxt, POP_DEFAULTS, splitScoreFields } from '../lib/scoreFormat'
import { decorationLength, normalizeDecoration, validateDecoration } from '../lib/decorationText'
import { preprocessAndConvertLyrics } from '../lib/textUtils'
import type { CentralPop, ScoreEntry } from '../lib/types'

const pop: CentralPop = { id: 'pop', text: 'Hey!', timestamp: 12.23, ...POP_DEFAULTS }
const page: ScoreEntry = { id: 'page', lyrics: ['アツく', '!A/B\\C', '', '★★★★'], decorations: [false, true, false, true], timestamp: 10.12 }

describe('new score format', () => {
  it('round trips katakana, decorations, escaped characters, empty lines, both pop formats and header', () => {
    const pops = [pop, { ...pop, id: 'other', text: 'A/B\\C!', timestamp: 14.5, duration: 'x' as const, align: 'r' as const, size: 'l' as const, color: '#123ABC' }]
    const txt = createScoreTxt(120.5, [page], pops)
    expect(txt).toContain('!!A\\/B\\\\C')
    expect(txt).toContain('!/!/!/!/999.9\n_\nHey!/12.23\n')
    const parsed = parseScoreTxt(txt)
    expect(parsed.duration).toBe(120.5)
    expect(parsed.scoreEntries[0]).toMatchObject({ ...page, id: expect.any(String) })
    expect(parsed.centralPops).toEqual(pops.map(p => ({ ...p, id: expect.any(String) })))
  })

  it('uses defaults for short form and writes default long form compactly', () => {
    const parsed = parseScoreTxt('30\n!/!/!/!/999.9\n_\nHey!/12.23/m/c/m/#ffffff\n')
    expect(parsed.centralPops[0]).toMatchObject(POP_DEFAULTS)
    expect(createScoreTxt(30, [], parsed.centralPops)).toContain('Hey!/12.23\n')
  })

  it('loads legacy pages without pop separator and omits the separator when no pops exist', () => {
    const parsed = parseScoreTxt('30\nあ/!/!/!/1.00\n!/!/!/!/999.9\n')
    expect(parsed.scoreEntries[0].lyrics).toEqual(['あ', '', '', ''])
    expect(parsed.centralPops).toEqual([])
    expect(createScoreTxt(30, parsed.scoreEntries, [])).not.toContain('_')
  })

  it('preserves decoration-only pages and same-time pops', () => {
    const txt = createScoreTxt(30, [{ ...page, lyrics: ['飾り', '', '', ''], decorations: [true, false, false, false] }], [pop, { ...pop, id: '2' }])
    expect(parseScoreTxt(txt).scoreEntries[0].lyrics[0]).toBe('飾り')
    expect(parseScoreTxt(txt).centralPops).toHaveLength(2)
  })

  it.each(['Hey!/1/m', 'Hey!/1/z/c/m/#FFFFFF', 'Hey!/1/m/z/m/#FFFFFF', 'Hey!/1/m/c/z/#FFFFFF', 'Hey!/1/m/c/m/FFFFFF', 'Hey!/-1', 'Hey!/Infinity', 'Hey!/1abc', '😀/1', 'Hey\\q/1'])('rejects invalid pop %s with a line number', line => {
    expect(() => parseScoreTxt(`30\n_\n${line}`)).toThrow(/3行目/)
  })

  it('does not split escaped delimiters and decodes consecutive escapes', () => {
    expect(splitScoreFields(String.raw`A\/B/C\\/D`)).toEqual(['A/B', 'C\\', 'D'])
    expect(() => splitScoreFields('abc\\')).toThrow()
  })

  it('truncates overlength imports with a warning and rejects forbidden characters', () => {
    const parsed = parseScoreTxt(`30\n!${'a'.repeat(51)}/!/!/!/0\n_\n${'あ'.repeat(26)}/1`)
    expect(parsed.scoreEntries[0].lyrics[0]).toHaveLength(50)
    expect(parsed.centralPops[0].text).toHaveLength(10)
    expect(parsed.warnings).toHaveLength(2)
    expect(() => parseScoreTxt('30\n!😀/!/!/!/0')).toThrow(/絵文字/)
    expect(() => createScoreTxt(30, [], [{ ...pop, text: 'A\nB' }])).toThrow(/改行/)
  })
})

describe('text normalization', () => {
  it('preserves katakana and combines halfwidth voiced kana', () => {
    expect(preprocessAndConvertLyrics('ｶﾞｯﾂﾎﾟｰｽﾞ カタカナ ヰヱゔ')).toBe('ガッツポーズ　カタカナ　ゐゑヴ')
  })
  it('counts displayed half/full width and truncates without breaking a character', () => {
    expect(decorationLength('Ａaあｱ')).toBe(3)
    expect(normalizeDecoration('あ'.repeat(24) + 'a漢')).toBe('あ'.repeat(24) + 'a')
    expect(normalizeDecoration('a'.repeat(51))).toHaveLength(50)
    expect(normalizeDecoration('あ'.repeat(26))).toHaveLength(25)
    expect(normalizeDecoration('𠮷'.repeat(26))).toBe('𠮷'.repeat(25))
    expect(normalizeDecoration('A/B\\C!')).toBe('A/B\\C!')
  })
  it.each(['😀', '🏻', '🇯🇵', '1️⃣', '©️', 'A\r\nB', 'A\u2028B'])('rejects forbidden text %s', value => {
    expect(() => validateDecoration(value)).toThrow()
  })
})
