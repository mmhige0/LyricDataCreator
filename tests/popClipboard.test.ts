import { expect, it } from 'vitest'
import { parsePopClipboard, serializePopClipboard } from '../lib/popClipboard'
import type { CentralPop } from '../lib/types'

const pop: CentralPop = { id: 'original', timestamp: 12.34, text: 'Hey!/\\', duration: 'x', align: 'r', size: 'l', color: '#ABCDEF' }
it('copies all pop content without the id or timestamp', () => {
  const encoded = serializePopClipboard(pop)
  expect(JSON.parse(encoded)).not.toHaveProperty('timestamp')
  expect(JSON.parse(encoded)).not.toHaveProperty('id')
  expect(parsePopClipboard(encoded)).toEqual({ text: 'Hey!/\\', duration: 'x', align: 'r', size: 'l', color: '#ABCDEF' })
  expect({ ...pop, timestamp: 56.78, ...parsePopClipboard(encoded) }.timestamp).toBe(56.78)
})
it('ignores injected timestamps and normalizes pasted text and colors', () => {
  const value = parsePopClipboard(JSON.stringify({ type: 'lyric-pop', ...pop, text: '★'.repeat(30) + '\n', color: '#abcdef' }))
  expect(value).not.toHaveProperty('timestamp')
  expect(value.text).toBe('★'.repeat(25))
  expect(value.color).toBe('#ABCDEF')
})
it.each(['plain lyrics', '{}', JSON.stringify({ type: 'lyric-pop', ...pop, duration: 'invalid' }), JSON.stringify({ type: 'lyric-pop', ...pop, color: '#bad' })])('rejects invalid clipboard data %s', data => {
  expect(() => parsePopClipboard(data)).toThrow()
})
