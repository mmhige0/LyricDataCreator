import { buildTypingMap, createTypingWord, type BuiltMapLine, type RawMapLine, type TypingWord } from 'lyrics-typing-engine'
import type { ScoreEntry } from './types'
import { preprocessAndConvertLyrics } from './textUtils'

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
 * - 1ページ(4行)を1 lineとして扱う
 * - 行境界はスペースで連結し、スペースも単語境界として扱う
 * - 最終行にYouTubeの総時間をtimeとしたend行を追加する
 */
const normalizeVuToHiragana = (line: string): string => line.replace(/ヴ/g, 'ゔ')
const normalizeSpacesToHalfWidth = (line: string): string => line.replace(/\u3000/g, ' ')

export const buildPageTypingData = ({ scoreEntries, totalDuration }: BuildPageTypingDataParams): PageTypingData => {
  const pageLyrics: string[][] = []
  const rawMapLines: RawMapLine[] = []

  for (const entry of scoreEntries) {
    const processedLines = entry.lyrics.map((line) => normalizeSpacesToHalfWidth(normalizeVuToHiragana(preprocessAndConvertLyrics(line))))
    const word = processedLines.join(' ')

    rawMapLines.push({
      time: entry.timestamp,
      lyrics: word,
      word,
    })

    pageLyrics.push(processedLines)
  }

  const lastTimestamp = scoreEntries[scoreEntries.length - 1]?.timestamp ?? 0
  const endTime = Math.max(totalDuration, lastTimestamp)

  rawMapLines.push({
    time: endTime,
    lyrics: 'end',
    word: '',
  })

  const builtMapLines = applyNEndingPatch(buildTypingMap({ rawMapLines, charPoint: 100 }))

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
          point: 100 * 2,
        }
      }
      return chunk
    })
    return { ...line, wordChunks }
  })
}
