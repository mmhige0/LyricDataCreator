import { expect, it } from 'vitest'
import { normalizePopText, validatePopText } from '../lib/popText'
import { normalizeDecoration, validateDecoration } from '../lib/decorationText'
import { createScoreTxt, parseScoreTxt, POP_DEFAULTS } from '../lib/scoreFormat'
import { parsePopClipboard, serializePopClipboard } from '../lib/popClipboard'

const pop = { id: 'pop', timestamp: 12.23, text: 'Wake up\nget up', ...POP_DEFAULTS }
it('round trips two-line pops in both TXT formats without creating physical lines', () => {
  for (const value of [pop, { ...pop, duration: 'x' as const, color: '#123456' }]) {
    const txt = createScoreTxt(30, [], [value])
    expect(txt.split('\n').filter(line => line.startsWith('Wake'))).toHaveLength(1)
    expect(txt).toContain('Wake up\\nget up/12.23')
    expect(parseScoreTxt(txt).centralPops[0]).toMatchObject({ ...value, id: expect.any(String) })
  }
})
it('distinguishes actual newlines, literal backslash-n, slash and backslash', () => {
  const value = { ...pop, text: 'A\nB\\n/\\' }
  const txt = createScoreTxt(30, [], [value])
  expect(txt).toContain('A\\nB\\\\n\\/\\\\/12.23')
  expect(parseScoreTxt(txt).centralPops[0].text).toBe(value.text)
})
it('counts widths across both lines but never counts the newline', () => {
  const value = 'あ'.repeat(5) + '\n' + 'a'.repeat(10)
  expect(normalizePopText(value)).toBe(value)
  expect(() => validatePopText(value)).not.toThrow()
  expect(normalizePopText(value + '𠮷')).toBe(value)
  expect(() => validatePopText(value + '𠮷')).toThrow(/10文字/)
})
it('normalizes pasted line endings, removes emoji, and keeps at most two lines', () => {
  expect(normalizePopText('A\r\nB\rC')).toBe('A\nB')
  expect(normalizePopText('A😀\nB😀')).toBe('A\nB')
  expect(() => validatePopText('A\nB\nC')).toThrow(/最大2行/)
  expect(() => validatePopText('A\r\nB')).toThrow()
  expect(() => validatePopText('A\n😀')).toThrow()
})
it('truncates an imported pop to the shared width while preserving its line break', () => {
  const result = parseScoreTxt(`30\n_\n${'あ'.repeat(5)}\\n${'あ'.repeat(6)}/1`)
  expect(result.centralPops[0].text).toBe('あ'.repeat(5) + '\n' + 'あ'.repeat(5))
  expect(result.warnings).toHaveLength(1)
})
it('rejects three-line files and newline escapes outside a pop text field', () => {
  expect(() => parseScoreTxt('30\n_\nA\\nB\\nC/1')).toThrow(/最大2行/)
  expect(() => parseScoreTxt('30\n![l]A\\nB/!/!/!/0')).toThrow()
  expect(() => parseScoreTxt('30\nA\\nB/!/!/!/0')).toThrow()
  expect(() => parseScoreTxt('30\n_\nA/1\\n2')).toThrow()
})
it('keeps multiline clipboard content and decorations continue to prohibit newlines', () => {
  expect(parsePopClipboard(serializePopClipboard(pop)).text).toBe(pop.text)
  expect(normalizeDecoration('A\nB')).toBe('AB')
  expect(() => validateDecoration('A\nB')).toThrow()
})
