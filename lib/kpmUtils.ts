import type { ScoreEntry } from './types'
import { convertLyricsArrayToRomaji } from './hiraganaUtils'

/**
 * 行別KPM情報
 */
export interface LineKpmInfo {
  line: number
  romaji: string
  charCount: number
  kpm: number
}

/**
 * ページのKPM情報
 */
export interface PageKpmInfo {
  id: string
  timestamp: number
  nextTimestamp: number | null
  duration: number
  lines: LineKpmInfo[]
  totalKpm: number
}

/**
 * ローマ字文字列から文字数をカウント（スペースを除く、長音記号付き文字は2文字）
 */
const countRomajiCharacters = (romaji: string): number => {
  // スペースを除去
  const noSpaces = romaji.replace(/\s/g, '')

  // 長音記号付き文字（アクセント記号付き）のパターン
  const longVowelPattern = /[âêîôûāēīōūáéíóúàèìòùäëïöü]/g

  // 長音記号付き文字の数をカウント
  const longVowelCount = (noSpaces.match(longVowelPattern) || []).length

  // 基本文字数 + 長音記号付き文字の追加カウント（1文字を2文字として扱う）
  return noSpaces.length + longVowelCount
}

/**
 * KPMを計算（Keys Per Minute）
 * @param charCount 文字数
 * @param durationSeconds 時間（秒）
 * @returns KPM値
 */
export const calculateKpm = (charCount: number, durationSeconds: number): number => {
  if (durationSeconds <= 0) return 0
  return Math.round((charCount / durationSeconds) * 60 * 10) / 10 // 小数点1桁で四捨五入
}

/**
 * 単一ページの行別KPM情報を計算
 * @param entry スコアエントリ
 * @param nextTimestamp 次のページのタイムスタンプ（なければnull）
 * @returns ページのKPM情報
 */
export const calculatePageKpm = async (
  entry: ScoreEntry,
  nextTimestamp: number | null
): Promise<PageKpmInfo> => {
  // 次のページがない場合はデフォルト時間（20秒）を使用
  const duration = nextTimestamp ? nextTimestamp - entry.timestamp : 20

  // 歌詞をローマ字に変換
  const romajiLyrics = await convertLyricsArrayToRomaji(entry.lyrics)

  // 各行のKPM情報を計算
  const lines: LineKpmInfo[] = romajiLyrics.map((romaji, index) => {
    const charCount = countRomajiCharacters(romaji)
    const kpm = calculateKpm(charCount, duration)

    return {
      line: index + 1,
      romaji,
      charCount,
      kpm
    }
  })

  // 全体のKPMを計算（全行の合計文字数 / 時間）
  const totalCharCount = lines.reduce((sum, line) => sum + line.charCount, 0)
  const totalKpm = calculateKpm(totalCharCount, duration)

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    nextTimestamp,
    duration,
    lines,
    totalKpm
  }
}

