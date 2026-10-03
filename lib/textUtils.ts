import type { LyricsArray } from './types'
import { characterWidth, normalizeDecoration } from './decorationText'

/**
 * 半角文字を全角文字に変換する
 */
const halfWidthToFullWidth = (text: string): string => {
  return text
    .replace(/[!-~]/g, char => String.fromCharCode(char.charCodeAt(0) + 0xFEE0))
    .replace(/[¢£¬¯¦¥₩]/g, char => ({ '¢': '￠', '£': '￡', '¬': '￢', '¯': '￣', '¦': '￤', '¥': '￥', '₩': '￦' })[char]!)
    .replace(/ /g, '　')
}

/**
 * 通常行では全角文字と全角化できる文字を保持する
 */
const removeSymbols = (text: string): string => {
  return Array.from(text).filter(char => /^[ -~]$/.test(char)
    || (characterWidth(char) === 1 && !/[\p{C}\p{Zl}\p{Zp}]/u.test(char))).join('')
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
  const fullKana = (text || '').replace(/[\uFF61-\uFF9F]+/g, value => value.normalize('NFKC')).normalize('NFC')
  return removeSymbols(halfWidthToFullWidth(fullKana))
    .replace(/ヰ/g, 'ゐ').replace(/ヱ/g, 'ゑ')
    .replace(/ゔ/g, 'ヴ')
    .replace(/　+$/g, '')
}

export const isTypingCharacter = (char: string): boolean => /^[ぁ-ゖゝゞァ-ヺヽヾーＡ-Ｚａ-ｚ]$/.test(char)

// The engine treats display-only characters as spaces; the UI keeps the original text.
export const normalizeTypingDisplay = (text: string): string =>
  Array.from(preprocessAndConvertLyrics(text)).map(char =>
    isTypingCharacter(char) || char === '　' ? char : '　').join('')

/**
 * 行の種類に応じて通常歌詞または装飾文字列を整える
 */
export const processLyricsForSave = (lyrics: LyricsArray, decorations?: boolean[]): LyricsArray => {
  return lyrics.map((line, index) => decorations?.[index] ? normalizeDecoration(line) : preprocessAndConvertLyrics(line)) as LyricsArray
}
