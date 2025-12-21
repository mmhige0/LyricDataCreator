import { buildTypingMap, createTypingWord, type BuiltMapLine, type RawMapLine, type TypingWord } from 'lyrics-typing-engine'
import type { ScoreEntry } from './types'
import { preprocessAndConvertLyrics } from './textUtils'

export const ensureIntroPage = (scoreEntries: ScoreEntry[]): ScoreEntry[] => {
  if (scoreEntries.length === 0) return scoreEntries
  if (scoreEntries[0].timestamp === 0) return scoreEntries

  const introEntry: ScoreEntry = {
    id: 'intro-0',
    timestamp: 0,
    lyrics: ['', '', '', ''],
  }

  return [introEntry, ...scoreEntries]
}

interface BuildPageTypingDataParams {
  scoreEntries: ScoreEntry[]
  totalDuration: number
}

export interface PageTypingData {
  builtMapLines: BuiltMapLine[]
  pageLyrics: string[][]
}

/**
 * ScoreEntryの配列をlyrics-typing-engine用のビルド済みデータに変換する
 * - 最初のページが0秒より後ろなら、0秒に空ページを自動で付与する
 * - 1ページ(4行)を1 lineとして扱う
 * - 行境界は全角スペースで連結し、スペースも単語境界として扱う
 * - 最終行にYouTubeの総時間をtimeとしたend行を追加する
 */
const normalizeVuToHiragana = (line: string): string => line.replace(/ヴ/g, 'ゔ')

export const buildPageTypingData = ({ scoreEntries, totalDuration }: BuildPageTypingDataParams): PageTypingData => {
  const normalizedEntries = ensureIntroPage(scoreEntries)
  const pageLyrics: string[][] = []
  const rawMapLines: RawMapLine[] = []

  for (const entry of normalizedEntries) {
    const processedLines = entry.lyrics.map((line) => normalizeVuToHiragana(preprocessAndConvertLyrics(line)))
    const hasLyrics = processedLines.some((line) => line.length > 0)
    const word = hasLyrics ? processedLines.join('　').trim() : ''

    rawMapLines.push({
      time: entry.timestamp,
      lyrics: hasLyrics ? word : '',
      word,
    })

    pageLyrics.push(processedLines)
  }

  const lastTimestamp = normalizedEntries[normalizedEntries.length - 1]?.timestamp ?? 0
  const endTime = Math.max(totalDuration, lastTimestamp)

  rawMapLines.push({
    time: endTime,
    lyrics: 'end',
    word: '',
  })

  const builtMapLines = applyNEndingPatch(buildTypingMap({ rawMapLines, charPoint: 0 }))

  return {
    builtMapLines,
    pageLyrics,
  }
}

export const createTypingWordForPage = (builtMapLines: BuiltMapLine[], pageIndex: number): TypingWord | null => {
  const targetLine = builtMapLines[pageIndex]
  if (!targetLine || targetLine.lyrics === 'end') return null
  return createTypingWord(targetLine)
}

export const skipSpaces = (typingWord: TypingWord): TypingWord => {
  let nextTypingWord = typingWord
  const isSkippableSpace = (chunk: TypingWord['nextChunk']) =>
    chunk.type === 'space' || chunk.kana === ' ' || chunk.kana === '　'

  while (isSkippableSpace(nextTypingWord.nextChunk)) {
    const nextIndex = nextTypingWord.wordChunksIndex
    const nextChunk = nextTypingWord.wordChunks[nextIndex]
    nextTypingWord = {
      correct: {
        kana: nextTypingWord.correct.kana + nextTypingWord.nextChunk.kana,
        roma: nextTypingWord.correct.roma + (nextTypingWord.nextChunk.romaPatterns[0] ?? ''),
      },
      nextChunk: nextChunk ?? { kana: '', romaPatterns: [], point: 0, type: undefined },
      wordChunks: nextTypingWord.wordChunks,
      wordChunksIndex: nextChunk ? nextIndex + 1 : nextIndex,
    }
    if (!nextChunk) break
  }
  return nextTypingWord
}

// 「ん」の直後がスペース/行末の場合は nn または n' を許容するように強制上書き
const applyNEndingPatch = (builtMapLines: BuiltMapLine[]): BuiltMapLine[] => {
  return builtMapLines.map((line) => {
    if (line.lyrics === 'end') return line
    const wordChunks = line.wordChunks.map((chunk, index) => {
      const nextChunk = line.wordChunks[index + 1]
      const isSpaceNext = nextChunk?.type === 'space' || nextChunk?.kana === ' ' || nextChunk?.kana === '　' || !nextChunk
      if (chunk.kana === 'ん' && isSpaceNext) {
        return {
          ...chunk,
          romaPatterns: ['nn', "n'", 'xn'],
          point: chunk.point,
        }
      }
      return chunk
    })
    return { ...line, wordChunks }
  })
}
