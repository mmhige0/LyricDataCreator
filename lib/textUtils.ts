import type { LyricsArray } from './types'
import { normalizeDecoration } from './decorationText'

/**
 * 半角文字を全角文字に変換する
 */
const halfWidthToFullWidth = (text: string): string => {
  return text
    .replace(/[a-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "a".charCodeAt(0) + "ａ".charCodeAt(0)))
    .replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "A".charCodeAt(0) + "Ａ".charCodeAt(0)))
    .replace(/ /g, "　")
}

/**
 * アルファベット・スペース以外の記号を削除する
 */
const removeSymbols = (text: string): string => {
  // 「々」は漢字ではないため明示的に許容する
  return text.replace(/[^\u3040-\u309F\u30A0-\u30FF\u3005\u4E00-\u9FAF\uFF66-\uFF9F\uFF21-\uFF3A\uFF41-\uFF5Aa-zA-Z\s]/g, "")
}

/**
 * カタカナをひらがなに変換する（高速変換）
 * @param text 変換対象のテキスト
 * @returns ひらがなに変換されたテキスト
 */
export const convertKatakanaToHiragana = (text: string): string => {
  if (!text) return text
  return text.replace(/[\u30A1-\u30F6]/g, (match) => {
    const code = match.charCodeAt(0)
    return String.fromCharCode(code - 0x60)
  })
}

/**
 * 通常歌詞の前処理（カタカナを保持し、半角カナと例外文字を正規化）
 * @param text 処理対象のテキスト
 * @returns 前処理が完了したテキスト
 */
export const preprocessAndConvertLyrics = (text: string): string => {
  const fullKana = (text || '').replace(/[\uFF66-\uFF9F]+/g, value => value.normalize('NFKC')).normalize('NFC')
  return halfWidthToFullWidth(removeSymbols(fullKana.replace(/[〜～]/g, 'ー')).trim())
    .replace(/ヰ/g, 'ゐ').replace(/ヱ/g, 'ゑ')
    .replace(/ゔ/g, 'ヴ')
    .replace(/\s{2,}/g, '　')
}

/**
 * 行の種類に応じて通常歌詞または装飾文字列を整える
 */
export const processLyricsForSave = (lyrics: LyricsArray, decorations?: boolean[]): LyricsArray => {
  return lyrics.map((line, index) => decorations?.[index] ? normalizeDecoration(line) : preprocessAndConvertLyrics(line)) as LyricsArray
}
