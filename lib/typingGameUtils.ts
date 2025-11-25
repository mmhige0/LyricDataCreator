import type { ScoreEntry } from '@/lib/types'
import type { TypingWord } from 'lyrics-typing-engine'

export interface PageState {
  pageIndex: number
  typingWord: TypingWord
  pageStartTime: number | null
  pageLastInputTime: number | null
}

export const createEmptyTypingWord = (): TypingWord => ({
  correct: { kana: '', roma: '' },
  nextChunk: { kana: '', romaPatterns: [], point: 0, type: undefined },
  wordChunks: [],
})

export const createBeforeFirstPageState = (): PageState => ({
  pageIndex: -1,
  typingWord: createEmptyTypingWord(),
  pageStartTime: null,
  pageLastInputTime: null,
})

export const findTargetPageIndexByTime = (
  entries: ScoreEntry[],
  currentVideoTime: number
): number => {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (currentVideoTime >= entries[i].timestamp) {
      return i
    }
  }
  return -1
}
