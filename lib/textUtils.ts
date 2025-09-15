import type { LyricsArray } from './types'

/**
 * 半角文字を全角文字に変換する
 */
export const halfWidthToFullWidth = (text: string): string => {
  return text
    .replace(/[a-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "a".charCodeAt(0) + "ａ".charCodeAt(0)))
    .replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "A".charCodeAt(0) + "Ａ".charCodeAt(0)))
    .replace(/ /g, "　")
}

/**
 * 全ての歌詞行を全角に変換する
 */
export const convertAllLyricsToFullWidth = (
  lyrics: LyricsArray,
  setLyrics: (lyrics: LyricsArray) => void
): void => {
  const newLyrics = lyrics.map(line => halfWidthToFullWidth(line)) as LyricsArray
  setLyrics(newLyrics)
}

/**
 * アルファベット・スペース以外の記号を削除する
 */
export const removeSymbols = (text: string): string => {
  return text.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF66-\uFF9F\uFF21-\uFF3A\uFF41-\uFF5Aa-zA-Z\s]/g, "")
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
 * 歌詞の前処理とカタカナ→ひらがな変換（記号削除、前後スペース削除、全角変換、カタカナ→ひらがな変換）
 * @param text 処理対象のテキスト
 * @returns 前処理とカタカナ変換が完了したテキスト
 */
export const preprocessAndConvertLyrics = (text: string): string => {
  return convertKatakanaToHiragana(halfWidthToFullWidth(removeSymbols(text || "").trim()))
}

/**
 * 歌詞配列の各行を処理して返す（記号削除、前後スペース削除、全角変換、カタカナ→ひらがな変換）
 */
export const processLyricsForSave = (lyrics: LyricsArray): LyricsArray => {
  return [
    preprocessAndConvertLyrics(lyrics[0]),
    preprocessAndConvertLyrics(lyrics[1]),
    preprocessAndConvertLyrics(lyrics[2]),
    preprocessAndConvertLyrics(lyrics[3])
  ]
}