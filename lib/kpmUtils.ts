import { parseWordToChunks, type WordChunk } from 'lyrics-typing-engine'
import { buildPageTypingData, ensureIntroPage } from './typingEngineAdapter'
import { preprocessAndConvertLyrics } from './textUtils'
import { convertKanjiToHiragana } from './hiraganaUtils'
import type { ScoreEntry } from './types'

export interface LineKpmInfo {
  line: number
  romaji: string
  kana: string
  charCount: {
    roma: number
    kana: number
  }
  kpm: {
    roma: number
    kana: number
  }
}

export interface PageKpmInfo {
  id: string
  timestamp: number
  duration: number
  lines: LineKpmInfo[]
  totalKpm: {
    roma: number
    kana: number
  }
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

const buildRomajiAndCount = async (
  line: string
): Promise<{ romaji: string; kana: string; charCount: { roma: number; kana: number } }> => {
  const processed = preprocessAndConvertLyrics(line)
  if (!processed) return { romaji: '', kana: '', charCount: { roma: 0, kana: 0 } }

  const hiragana = await convertKanjiToHiragana(processed)
  const target = hiragana || processed

  let wordChunks: WordChunk[] = []

  try {
    wordChunks = parseWordToChunks({ word: target, charPoint: 0 })
  } catch (error) {
    console.error('Failed to parse word for KPM calculation', error)
    const fallbackRomaji = target.replace(/\s/g, '')
    const fallbackKana = target.replace(/\s/g, '')
    return { romaji: fallbackRomaji, kana: fallbackKana, charCount: { roma: fallbackRomaji.length, kana: fallbackKana.length } }
  }

  let romaji = ''
  let kana = ''
  let charCount = { roma: 0, kana: 0 }

  for (const chunk of wordChunks) {
    const roma = chunk.romaPatterns[0] ?? ''
    if (isSpaceChunk(chunk)) {
      romaji += ' '
      kana += ' '
      continue
    }
    romaji += roma
    kana += chunk.kana
    charCount = {
      roma: charCount.roma + roma.length,
      kana: charCount.kana + chunk.kana.replace(/\s/g, '').length,
    }
  }

  return { romaji, kana, charCount }
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
        const { romaji, kana, charCount } = await buildRomajiAndCount(line)
        const kpm = {
          roma: calculateKpm(charCount.roma, builtLine.duration),
          kana: calculateKpm(charCount.kana, builtLine.duration),
        }
        return {
          line: lineIndex + 1,
          romaji,
          kana,
          charCount,
          kpm,
        }
      })
    )

    const totalCharCount = lines.reduce(
      (sum, line) => ({
        roma: sum.roma + line.charCount.roma,
        kana: sum.kana + line.charCount.kana,
      }),
      { roma: 0, kana: 0 }
    )

    map.set(entry.id, {
      id: entry.id,
      timestamp: entry.timestamp,
      duration: builtLine.duration,
      lines,
      totalKpm: {
        roma: calculateKpm(totalCharCount.roma, builtLine.duration),
        kana: calculateKpm(totalCharCount.kana, builtLine.duration),
      },
    })
  }

  return map
}
