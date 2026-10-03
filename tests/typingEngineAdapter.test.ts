import { describe, expect, it } from 'vitest'
import { executeTypingInput } from 'lyrics-typing-engine'
import { buildPageTypingData, createTypingWordForPageLines, skipSpaces } from '../lib/typingEngineAdapter'
import type { ScoreEntry } from '../lib/types'

const entry: ScoreEntry = {
  id: 'page', timestamp: 0,
  lyrics: ['カタカナ', '飾り★/!', 'ヴァン', ''],
  decorations: [false, true, false, false],
}
const wordFor = (scoreEntry = entry, indexes = [0, 1, 2, 3]) => createTypingWordForPageLines({
  scoreEntries: [scoreEntry], totalDuration: 10, pageIndex: 0, targetLineIndexes: indexes,
})!

describe('typing katakana and decoration', () => {
  it.each(['roma', 'kana'] as const)('accepts katakana with the same %s input as hiragana', inputMode => {
    const katakana = wordFor()
    const hiragana = wordFor({ ...entry, lyrics: ['かたかな', '飾り★/!', 'ゔぁん', ''] })
    expect(katakana).toEqual(hiragana)
    let word = katakana
    const keys = inputMode === 'roma' ? 'katakanavann' : 'かたかなゔぁん'
    for (const inputChar of keys) {
      const result = executeTypingInput({ inputChar, inputMode, typingWord: skipSpaces(word) })
      expect(result.failKey).toBeFalsy()
      expect(result.successKey).toBeTruthy()
      word = result.nextTypingWord
    }
    expect(word.nextChunk.kana).toBe('')
  })

  it('keeps original katakana and decoration for display while excluding decoration from the engine', () => {
    const data = buildPageTypingData({ scoreEntries: [entry], totalDuration: 10 })
    expect(data.pageLyrics[0]).toEqual(entry.lyrics)
    expect(data.builtMapLines[0].wordChunks.map(chunk => chunk.kana).join('')).not.toContain('飾り')
    expect(wordFor(entry, [1]).nextChunk.kana).toBe('')
  })

  it('creates no typing targets for a decoration-only page', () => {
    const decorated: ScoreEntry = { ...entry, decorations: [true, true, true, true] }
    expect(wordFor(decorated).nextChunk.kana).toBe('')
    const data = buildPageTypingData({ scoreEntries: [decorated], totalDuration: 10 })
    expect(data.builtMapLines[0].wordChunks.map(chunk => chunk.kana).join('')).toBe('')
    expect(data.pageLyrics[0]).toEqual(decorated.lyrics)
  })
})
