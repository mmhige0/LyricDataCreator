import { parseWordToChunks, type WordChunk } from 'lyrics-typing-engine'
import { buildPageTypingData, ensureIntroPage } from './typingEngineAdapter'
import { preprocessAndConvertLyrics } from './textUtils'
import { convertKanjiToHiragana } from './hiraganaUtils'
import type { ScoreEntry } from './types'

export interface LineKpmInfo {
  line: number
  romaji: string
  charCount: number
  kpm: number
}

export interface PageKpmInfo {
  id: string
  timestamp: number
  duration: number
  lines: LineKpmInfo[]
  totalKpm: number
}

interface BuildKpmParams {
  scoreEntries: ScoreEntry[]
  totalDuration: number
}

const calculateKpm = (charCount: number, durationSeconds: number): number => {
  if (durationSeconds <= 0) return 0
  return Math.round((charCount / durationSeconds) * 60 * 10) / 10
}

const isSpaceChunk = (chunk: WordChunk): boolean =>
  chunk.type === 'space' || chunk.kana === ' ' || chunk.kana === '　'

const buildRomajiAndCount = async (line: string): Promise<{ romaji: string; charCount: number }> => {
  const processed = preprocessAndConvertLyrics(line)
  if (!processed) return { romaji: '', charCount: 0 }

  const hiragana = await convertKanjiToHiragana(processed)
  const target = hiragana || processed

  let wordChunks: WordChunk[] = []

  try {
    wordChunks = parseWordToChunks({ word: target, charPoint: 0 })
  } catch (error) {
    console.error('Failed to parse word for KPM calculation', error)
    const fallbackRomaji = target.replace(/\s/g, '')
    return { romaji: fallbackRomaji, charCount: fallbackRomaji.length }
  }

  let romaji = ''
  let charCount = 0

  for (const chunk of wordChunks) {
    const roma = chunk.romaPatterns[0] ?? ''
    if (isSpaceChunk(chunk)) {
      romaji += ' '
      continue
    }
    romaji += roma
    charCount += roma.length
  }

  return { romaji, charCount }
}

/**
 * lyrics-typing-engineのdurationを使い、ローマ字ベースで行/ページの要求KPMを算出
 * - romaji/kanaのうち、まずはromajiのみ算出
 * - 0秒行を自動追加するため、元のscoreEntriesに存在しないidはスキップする
 */
export const buildPageKpmMap = async ({ scoreEntries, totalDuration }: BuildKpmParams): Promise<Map<string, PageKpmInfo>> => {
  const map = new Map<string, PageKpmInfo>()
  if (scoreEntries.length === 0) return map

  const originalIds = new Set(scoreEntries.map((entry) => entry.id))
  const normalizedEntries = ensureIntroPage(scoreEntries)
  const { builtMapLines } = buildPageTypingData({
    scoreEntries: normalizedEntries,
    totalDuration,
  })

  for (let index = 0; index < normalizedEntries.length; index++) {
    const entry = normalizedEntries[index]
    const builtLine = builtMapLines[index]
    const isEndLine = builtLine?.lyrics === 'end'
    const isInjected = !originalIds.has(entry.id)
    if (!builtLine || isEndLine || isInjected) continue

    // 行ごとにlyrics-typing-engineのチャンク分解からローマ字/文字数を生成
    const lines: LineKpmInfo[] = await Promise.all(
      entry.lyrics.map(async (line, lineIndex) => {
        const { romaji, charCount } = await buildRomajiAndCount(line)
        const kpm = calculateKpm(charCount, builtLine.duration)
        return {
          line: lineIndex + 1,
          romaji,
          charCount,
          kpm,
        }
      })
    )

    const totalCharCount = lines.reduce((sum, line) => sum + line.charCount, 0)

    map.set(entry.id, {
      id: entry.id,
      timestamp: entry.timestamp,
      duration: builtLine.duration,
      lines,
      totalKpm: calculateKpm(totalCharCount, builtLine.duration),
    })
  }

  return map
}
