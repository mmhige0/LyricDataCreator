import { expect, it } from 'vitest'
import { normalizePopText, validatePopText } from '../lib/popText'
import { createScoreTxt, parseScoreTxt, POP_DEFAULTS } from '../lib/scoreFormat'

it.each([
  ['あ'.repeat(11), 'あ'.repeat(10)],
  ['a'.repeat(21), 'a'.repeat(20)],
  ['あ'.repeat(9) + 'a漢', 'あ'.repeat(9) + 'a'],
  ['𠮷'.repeat(11), '𠮷'.repeat(10)],
])('truncates pop text by displayed width without breaking characters: %s', (input, expected) => {
  expect(normalizePopText(input)).toBe(expected)
  expect(() => validatePopText(expected)).not.toThrow()
  expect(() => validatePopText(input)).toThrow(/10文字/)
})
it('applies the pop limit to decoded imports while keeping decorations at 25', () => {
  const parsed = parseScoreTxt(`30\n!${'あ'.repeat(25)}/!/!/!/0\n_\n${'a'.repeat(21)}/1`)
  expect(parsed.scoreEntries[0].lyrics[0]).toHaveLength(25)
  expect(parsed.centralPops[0].text).toHaveLength(20)
  expect(parsed.warnings).toEqual(['4行目: ポップ文字列を10文字以内に切り取りました。'])
  expect(() => createScoreTxt(30, [], [{ id: 'pop', timestamp: 1, text: 'a'.repeat(21), ...POP_DEFAULTS }])).toThrow(/10文字/)
  expect(parseScoreTxt(createScoreTxt(30, parsed.scoreEntries, parsed.centralPops)).centralPops[0].text).toBe('a'.repeat(20))
})
